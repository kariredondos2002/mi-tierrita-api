import { createValidator } from "../common/validate";
import type { Role } from "../security/roles";

/**
 * Tiempo real (v4): chat del equipo, notificaciones, directorio de personas, búsqueda
 * global, perfil propio y contacto de la página pública.
 */

export const MESSAGE_MAX_LENGTH = 2000;

/** Persona tal como la ven el chat, la presencia y la búsqueda (sin datos sensibles). */
export type PersonSummary = { id: number; name: string; username: string; role: Role };

export type DirectoryEntry = PersonSummary & { lastSeenAt: string | null; online: boolean };

export type MessageKind = "TEXT" | "AUDIO" | "FILE";

/** Adjunto de un mensaje (el archivo se descarga aparte, con permisos, por /chat/attachments/:id). */
export type AttachmentInfo = { id: number; fileName: string; mimeType: string; sizeBytes: number; durationMs: number | null };

export type MessageRow = {
  id: number;
  senderId: number;
  senderName: string;
  senderUsername: string;
  senderRole: Role;
  recipientId: number | null;
  content: string;
  kind: MessageKind;
  readAt: Date | null;
  createdAt: Date;
  replyToId: number | null;
  replySenderName: string | null;
  replyPreview: string | null;
  replyKind: MessageKind | null;
  threadRootId: number | null;
  clientId: string | null;
  replyCount: number;
  pinnedAt: Date | null;
  pinnedBy: number | null;
  mentions: number[];
  attachmentId: number | null;
  attachmentName: string | null;
  attachmentMime: string | null;
  attachmentSize: number | null;
  attachmentDuration: number | null;
  /** Solo el autor ve los recibos; para los demás vienen en null. */
  receiptsTotal: number | null;
  receiptsDelivered: number | null;
  receiptsRead: number | null;
};

/** Resumen de recibos de un mensaje propio: cuántos lo recibieron y cuántos lo vieron. */
export type ReceiptSummary = { total: number; delivered: number; read: number };

export type MessageResponse = {
  id: number;
  sender: PersonSummary;
  recipientId: number | null;
  content: string;
  kind: MessageKind;
  readAt: string | null;
  createdAt: string;
  replyTo: { id: number; senderName: string; preview: string; kind: MessageKind } | null;
  threadRootId: number | null;
  /** Identificador que generó el cliente al enviar; permite fusionar el envío optimista sin duplicar. */
  clientId: string | null;
  replyCount: number;
  pinnedAt: string | null;
  pinnedBy: number | null;
  mentions: number[];
  attachment: AttachmentInfo | null;
  /** Solo en mensajes propios. */
  receipts: ReceiptSummary | null;
};

const PREVIEW_LENGTH = 140;

/** Texto corto de una cita: el contenido o, si es audio o archivo sin texto, una etiqueta. */
export const previewOf = (content: string, kind: MessageKind): string => {
  const text = content.trim().replace(/\s+/g, " ");
  if (text !== "") return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH - 1)}…` : text;
  return kind === "AUDIO" ? "Mensaje de audio" : kind === "FILE" ? "Archivo adjunto" : "";
};

export const toMessageResponse = (row: MessageRow): MessageResponse => ({
  id: row.id,
  sender: { id: row.senderId, name: row.senderName, username: row.senderUsername, role: row.senderRole },
  recipientId: row.recipientId,
  content: row.content,
  kind: row.kind,
  readAt: row.readAt === null ? null : row.readAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
  replyTo:
    row.replyToId === null
      ? null
      : { id: row.replyToId, senderName: row.replySenderName ?? "", preview: previewOf(row.replyPreview ?? "", row.replyKind ?? "TEXT"), kind: row.replyKind ?? "TEXT" },
  threadRootId: row.threadRootId,
  replyCount: row.replyCount,
  pinnedAt: row.pinnedAt === null ? null : row.pinnedAt.toISOString(),
  pinnedBy: row.pinnedBy,
  clientId: row.clientId,
  mentions: row.mentions,
  attachment:
    row.attachmentId === null
      ? null
      : { id: row.attachmentId, fileName: row.attachmentName ?? "archivo", mimeType: row.attachmentMime ?? "application/octet-stream", sizeBytes: row.attachmentSize ?? 0, durationMs: row.attachmentDuration },
  receipts: row.receiptsTotal === null ? null : { total: row.receiptsTotal, delivered: row.receiptsDelivered ?? 0, read: row.receiptsRead ?? 0 },
});

/** Se quita lo que solo el autor debe ver antes de difundir un mensaje a otras personas. */
export const forAudience = (m: MessageResponse): MessageResponse => ({ ...m, receipts: null });

export type MessagePage = { messages: MessageResponse[]; hasMore: boolean };

/** `scope` identifica la conversación: "general" o el id de la otra persona. */
export type ConversationResponse = {
  person: PersonSummary;
  lastMessage: { id: number; content: string; kind: MessageKind; senderId: number; createdAt: string };
  unread: number;
};

/** Contenido de un mensaje: texto recortado de 1 a 2000 caracteres. */
export const parseMessageContent = (body: unknown): string => {
  const v = createValidator(body);
  const content = v.string("content", { min: 1, max: MESSAGE_MAX_LENGTH });
  v.done();
  return content as string;
};

export const parsePrivateMessage = (body: unknown): { recipientId: number; content: string } => {
  const v = createValidator(body);
  const recipientId = v.number("recipientId", { integer: true, min: 1 });
  const content = v.string("content", { min: 1, max: MESSAGE_MAX_LENGTH });
  v.done();
  return { recipientId: recipientId as number, content: content as string };
};

/** Envío completo (v4.5): texto y/o adjunto, con cita, hilo, destinatario y un identificador contra duplicados. */
export type SendMessageInput = {
  content: string;
  recipientId: number | null;
  replyToId: number | null;
  threadRootId: number | null;
  attachmentId: number | null;
  clientId: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const parseSendMessage = (body: unknown): SendMessageInput => {
  const v = createValidator(body);
  const content = v.string("content", { max: MESSAGE_MAX_LENGTH }, false) ?? "";
  const recipientId = v.number("recipientId", { integer: true, min: 1 }, false);
  const replyToId = v.number("replyToId", { integer: true, min: 1 }, false);
  const threadRootId = v.number("threadRootId", { integer: true, min: 1 }, false);
  const attachmentId = v.number("attachmentId", { integer: true, min: 1 }, false);
  const clientId = v.string("clientId", { max: 36, pattern: UUID, patternMessage: "Debe ser un UUID" }, false);
  const trimmed = content.trim();
  if (trimmed === "" && attachmentId === undefined) v.custom("content", "Escriba un mensaje o adjunte un archivo");
  v.done();
  return {
    content: trimmed,
    recipientId: recipientId ?? null,
    replyToId: replyToId ?? null,
    threadRootId: threadRootId ?? null,
    attachmentId: attachmentId ?? null,
    clientId: clientId ?? null,
  };
};

/** Búsqueda en el chat: ?q=texto&scope=general|<id de persona>&limit=. */
export type ChatSearchQuery = { q: string; scope: "general" | number | null; limit: number };

export const parseChatSearch = (query: Record<string, unknown>): ChatSearchQuery => {
  const q = typeof query["q"] === "string" ? query["q"].trim().slice(0, 80) : "";
  const rawScope = query["scope"];
  const num = Number(rawScope);
  const scope = rawScope === "general" ? "general" : Number.isInteger(num) && num > 0 ? num : null;
  const rawLimit = Number(query["limit"]);
  return { q, scope, limit: Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 30 };
};

/** Tipos de archivo admitidos como adjunto y su límite (6 MB). */
export const ATTACHMENT_MAX_BYTES = 6 * 1024 * 1024;
export const ATTACHMENT_MIME = /^(audio\/(webm|ogg|mp4|mpeg|wav|x-m4a|aac)|image\/(png|jpeg|webp|gif)|application\/(pdf|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|msword|vnd\.ms-excel)|text\/(plain|csv))(;.*)?$/i;

/** Cursor de historial: ?before=<ISO>&limit=<1..100>. */
export type HistoryQuery = { before?: Date | undefined; limit: number };

export const parseHistoryQuery = (query: Record<string, unknown>): HistoryQuery => {
  const rawLimit = Number(query["limit"]);
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 40;
  const rawBefore = typeof query["before"] === "string" ? new Date(query["before"]) : undefined;
  const before = rawBefore !== undefined && !Number.isNaN(rawBefore.getTime()) ? rawBefore : undefined;
  return { before, limit };
};

// --- notificaciones ---

export const NotificationKinds = {
  SALE: "SALE",
  SALE_VOIDED: "SALE_VOIDED",
  PAYMENT: "PAYMENT",
  PURCHASE: "PURCHASE",
  LOW_STOCK: "LOW_STOCK",
  SCENARIO: "SCENARIO",
  CONTACT: "CONTACT",
  MESSAGE: "MESSAGE",
} as const;
export type NotificationKind = (typeof NotificationKinds)[keyof typeof NotificationKinds];

export type NotificationRow = { id: number; kind: NotificationKind; message: string; link: string | null; read: boolean; createdAt: Date };
export type NotificationResponse = Omit<NotificationRow, "createdAt"> & { createdAt: string };

export const toNotificationResponse = (row: NotificationRow): NotificationResponse => ({ ...row, createdAt: row.createdAt.toISOString() });

export type NotificationInput = { kind: NotificationKind; message: string; link?: string | null };

export const parseMarkNotifications = (body: unknown): { ids?: number[] | undefined } => {
  const v = createValidator(body ?? {});
  const ids = v.array("ids", { max: 200 }, () => undefined, false);
  v.done();
  const raw = (body as { ids?: unknown } | undefined)?.ids;
  if (ids === undefined || !Array.isArray(raw)) return {};
  return { ids: raw.filter((n): n is number => Number.isInteger(n) && (n as number) > 0) };
};

// --- perfil propio ---

export type UpdateProfileRequest = { firstName: string; lastName: string; email: string | null; phone: string | null };

const EMAIL_RULE = { max: 160, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMessage: "Correo inválido" };
const PHONE_RULE = { max: 40, pattern: /^[0-9+()\s-]{7,40}$/, patternMessage: "Solo números, espacios, +, ( ) y guiones" };

/** Mi perfil (v4.2, como en SoftUnity): nombre, apellido, correo y teléfono; vacío borra el dato opcional. */
export const parseUpdateProfile = (body: unknown): UpdateProfileRequest => {
  const v = createValidator(body);
  const firstName = v.string("firstName", { min: 1, max: 80 });
  const lastName = v.string("lastName", { min: 1, max: 80 });
  const rawEmail = (body as { email?: unknown } | null)?.email;
  const rawPhone = (body as { phone?: unknown } | null)?.phone;
  const email = typeof rawEmail === "string" && rawEmail.trim() !== "" ? v.string("email", EMAIL_RULE, false) : undefined;
  const phone = typeof rawPhone === "string" && rawPhone.trim() !== "" ? v.string("phone", PHONE_RULE, false) : undefined;
  v.done();
  return { firstName: firstName as string, lastName: lastName as string, email: email ? email.toLowerCase() : null, phone: phone ?? null };
};

/** Mi actividad: últimas acciones propias y conteos de los últimos 30 días. */
export type ActivityItem = { id: number; method: string; resource: string; detail: string | null; createdAt: string };
export type MyActivity = { items: ActivityItem[]; last30Days: { writes: number; exports: number; signins: number; sales: number; payments: number; batches: number }; lastSigninAt: string | null };

// --- búsqueda global ---

export type SearchResponse = {
  products: { id: number; name: string; sku: string; stock: number }[];
  customers: { id: number; name: string; document: string | null; balance: number }[];
  suppliers: { id: number; name: string }[];
  sales: { id: number; invoiceNumber: string; customerName: string | null; total: number; createdAt: string }[];
  people: PersonSummary[];
};

// --- contacto público ---

export type ContactRequest = { name: string; email?: string | undefined; phone?: string | undefined; topic?: string | undefined; message: string };
export type ContactResponse = Omit<ContactRequest, "email"> & { email: string | null; id: number; handled: boolean; createdAt: string };
/** Entrada del formulario público; `trap` es true si se llenó el campo oculto `website` (spam). */
export type ContactInput = ContactRequest & { trap: boolean };

/**
 * Formulario público: nombre, al menos un medio para responder (teléfono o correo) y el mensaje (`message`; se acepta
 * `body` como sinónimo). `website` es un campo trampa que las personas no ven: si llega lleno, el mensaje se descarta
 * en silencio.
 */
export const parseContact = (body: unknown): ContactInput => {
  const src = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const v = createValidator(src["message"] === undefined && src["body"] !== undefined ? { ...src, message: src["body"] } : body);
  const name = v.string("name", { min: 2, max: 120 });
  const email = v.string("email", { min: 5, max: 160, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMessage: "Correo inválido" }, false);
  const phone = v.string("phone", { max: 40 }, false);
  const topic = v.string("topic", { min: 1, max: 80 }, false);
  const message = v.string("message", { min: 5, max: 2000 });
  const website = v.string("website", { max: 200 }, false);
  if ((email === undefined || email === "") && (phone === undefined || phone === "") && !v.issues().some((i) => i.path === "email" || i.path === "phone")) {
    v.custom("phone", "Deje un teléfono o un correo para poder responderle");
  }
  v.done();
  return {
    name: name as string,
    email: email === undefined || email === "" ? undefined : email.toLowerCase(),
    phone: phone === undefined || phone === "" ? undefined : phone,
    topic: topic === undefined || topic === "" ? undefined : topic,
    message: message as string,
    trap: Boolean(website),
  };
};
