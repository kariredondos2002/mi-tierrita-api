import { db } from "../../data-sources/index";
import { ErrorCodes, domainError } from "../../common/index";
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME, type AttachmentInfo } from "../../models/index";
import { canSee } from "./messages";

const cleanName = (name: string): string =>
  name.replace(/[\\/\u0000-\u001f"<>|?*:]/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "archivo";

/**
 * Sube un archivo o un audio. Queda «huérfano» (sin mensaje) hasta que se envía el mensaje que lo usa; el subidor es el único
 * que puede adjuntarlo. Los huérfanos de más de un día se borran. Tipos permitidos y límite de 6 MB (models/realtime.ts).
 */
export const saveAttachment = async (uploaderId: number, fileName: string, mimeType: string, data: Buffer, durationMs: number | null): Promise<AttachmentInfo> => {
  if (data.length === 0 || data.length > ATTACHMENT_MAX_BYTES) {
    throw domainError(ErrorCodes.VALIDATION, [{ path: "file", message: `El archivo debe pesar entre 1 byte y ${ATTACHMENT_MAX_BYTES / 1024 / 1024} MB` }]);
  }
  if (!ATTACHMENT_MIME.test(mimeType)) throw domainError(ErrorCodes.VALIDATION, [{ path: "file", message: "Tipo de archivo no permitido" }]);
  const mime = mimeType.split(";")[0]?.trim().toLowerCase() ?? mimeType;
  const duration = durationMs !== null && Number.isInteger(durationMs) && durationMs > 0 && durationMs < 3_600_000 ? durationMs : null;
  await db.query(`DELETE FROM message_attachments WHERE message_id IS NULL AND created_at < now() - interval '1 day'`);
  const { rows } = await db.query<AttachmentInfo>(
    `INSERT INTO message_attachments (uploader_id, file_name, mime_type, size_bytes, duration_ms, data) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, file_name AS "fileName", mime_type AS "mimeType", size_bytes AS "sizeBytes", duration_ms AS "durationMs"`,
    [uploaderId, cleanName(fileName), mime, data.length, duration, data],
  );
  return rows[0] as AttachmentInfo;
};

/** Descarga con permisos: el adjunto de un mensaje lo ve quien ve el mensaje; el huérfano, solo quien lo subió. */
export const readAttachment = async (id: number, viewerId: number): Promise<{ fileName: string; mimeType: string; data: Buffer }> => {
  const { rows } = await db.query<{ fileName: string; mimeType: string; data: Buffer; uploaderId: number; messageId: number | null; senderId: number | null; recipientId: number | null }>(
    `SELECT a.file_name AS "fileName", a.mime_type AS "mimeType", a.data, a.uploader_id AS "uploaderId", a.message_id AS "messageId",
            m.sender_id AS "senderId", m.recipient_id AS "recipientId"
     FROM message_attachments a LEFT JOIN messages m ON m.id = a.message_id WHERE a.id = $1`,
    [id],
  );
  const a = rows[0];
  const allowed = a !== undefined && (a.messageId === null ? a.uploaderId === viewerId : canSee({ senderId: a.senderId as number, recipientId: a.recipientId }, viewerId));
  if (a === undefined || !allowed) throw domainError(ErrorCodes.MESSAGE_NOT_FOUND);
  return { fileName: a.fileName, mimeType: a.mimeType, data: a.data };
};
