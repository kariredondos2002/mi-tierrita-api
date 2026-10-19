import { db, type Queryable } from "../../data-sources/index";
import { ErrorCodes, domainError } from "../../common/index";
import {
  MESSAGE_MAX_LENGTH,
  toMessageResponse,
  type ConversationResponse,
  type HistoryQuery,
  type MessageKind,
  type MessagePage,
  type MessageResponse,
  type MessageRow,
  type SendMessageInput,
} from "../../models/index";
import { findUserById } from "../users/find-user";
import { likePattern } from "../search/search";

/**
 * Lectura de mensajes. El primer parámetro ($1) de todas las consultas es SIEMPRE la persona que mira: solo el autor de un
 * mensaje recibe el resumen de recibos (cuántos lo recibieron y cuántos lo vieron).
 */
export const MESSAGE_SELECT = `
  SELECT m.id, m.sender_id AS "senderId", (u.first_name || ' ' || u.last_name) AS "senderName",
         u.username AS "senderUsername", r.name AS "senderRole", m.recipient_id AS "recipientId",
         m.content, m.kind, m.read_at AS "readAt", m.created_at AS "createdAt",
         m.reply_to_id AS "replyToId", (ru.first_name || ' ' || ru.last_name) AS "replySenderName",
         rm.content AS "replyPreview", rm.kind AS "replyKind",
         m.thread_root_id AS "threadRootId",
         (SELECT COUNT(*) FROM messages t WHERE t.thread_root_id = m.id)::int AS "replyCount",
         m.pinned_at AS "pinnedAt", m.pinned_by AS "pinnedBy",
         COALESCE((SELECT array_agg(mm.user_id::int ORDER BY mm.user_id) FROM message_mentions mm WHERE mm.message_id = m.id), '{}') AS mentions,
         a.id AS "attachmentId", a.file_name AS "attachmentName", a.mime_type AS "attachmentMime",
         a.size_bytes AS "attachmentSize", a.duration_ms AS "attachmentDuration",
         CASE WHEN m.sender_id = $1 THEN (SELECT COUNT(*) FROM message_receipts x WHERE x.message_id = m.id)::int END AS "receiptsTotal",
         CASE WHEN m.sender_id = $1 THEN (SELECT COUNT(*) FROM message_receipts x WHERE x.message_id = m.id AND x.delivered_at IS NOT NULL)::int END AS "receiptsDelivered",
         CASE WHEN m.sender_id = $1 THEN (SELECT COUNT(*) FROM message_receipts x WHERE x.message_id = m.id AND x.read_at IS NOT NULL)::int END AS "receiptsRead"
  FROM messages m
  JOIN users u ON u.id = m.sender_id JOIN roles r ON r.id = u.role_id
  LEFT JOIN messages rm ON rm.id = m.reply_to_id LEFT JOIN users ru ON ru.id = rm.sender_id
  LEFT JOIN LATERAL (SELECT id, file_name, mime_type, size_bytes, duration_ms FROM message_attachments WHERE message_id = m.id ORDER BY id LIMIT 1) a ON TRUE`;

/** El canal general lo ve todo el equipo; un privado, solo sus dos participantes. */
export const canSee = (m: { senderId: number; recipientId: number | null }, userId: number): boolean =>
  m.recipientId === null || m.senderId === userId || m.recipientId === userId;

/** Un mensaje por id, tal como lo ve `viewerId`; undefined si no existe o no puede verlo (nunca revela que existe). */
export const getMessageFor = async (id: number, viewerId: number, q: Queryable = db): Promise<MessageResponse | undefined> => {
  const { rows } = await q.query<MessageRow>(`${MESSAGE_SELECT} WHERE m.id = $2`, [viewerId, id]);
  const row = rows[0];
  if (row === undefined || !canSee(row, viewerId)) return undefined;
  return toMessageResponse(row);
};

const page = async (viewerId: number, where: string, params: unknown[], q: HistoryQuery): Promise<MessagePage> => {
  const all: unknown[] = [viewerId, ...params];
  let cond = `${where} AND m.thread_root_id IS NULL`;
  if (q.before !== undefined) {
    all.push(q.before);
    cond += ` AND m.created_at < $${all.length}`;
  }
  all.push(q.limit + 1);
  const { rows } = await db.query<MessageRow>(
    `${MESSAGE_SELECT} WHERE ${cond} ORDER BY m.created_at DESC, m.id DESC LIMIT $${all.length}`,
    all,
  );
  const hasMore = rows.length > q.limit;
  return { messages: rows.slice(0, q.limit).reverse().map(toMessageResponse), hasMore };
};

/** Historial del canal general (sin las respuestas de hilo), paginado hacia atrás con ?before=. */
export const generalHistory = (viewerId: number, q: HistoryQuery): Promise<MessagePage> => page(viewerId, `m.recipient_id IS NULL`, [], q);

/** Historial de la conversación privada entre dos usuarios. */
export const privateHistory = async (userId: number, otherId: number, q: HistoryQuery): Promise<MessagePage> => {
  const other = await findUserById(otherId);
  if (other === undefined) throw domainError(ErrorCodes.USER_NOT_FOUND);
  return page(userId, `((m.sender_id = $1 AND m.recipient_id = $2) OR (m.sender_id = $2 AND m.recipient_id = $1))`, [otherId], q);
};

/** Hilo: el mensaje raíz y sus respuestas, de la más antigua a la más reciente. Solo si la persona puede ver la conversación. */
export const threadOf = async (rootId: number, viewerId: number): Promise<{ root: MessageResponse; replies: MessageResponse[] }> => {
  const root = await getMessageFor(rootId, viewerId);
  if (root === undefined || root.threadRootId !== null) throw domainError(ErrorCodes.MESSAGE_NOT_FOUND);
  const { rows } = await db.query<MessageRow>(`${MESSAGE_SELECT} WHERE m.thread_root_id = $2 ORDER BY m.created_at, m.id LIMIT 500`, [viewerId, rootId]);
  return { root, replies: rows.map(toMessageResponse) };
};

/** Mensajes fijados de una conversación: "general" o la otra persona. */
export const pinnedIn = async (viewerId: number, scope: "general" | number): Promise<MessageResponse[]> => {
  const where =
    scope === "general"
      ? `m.recipient_id IS NULL`
      : `((m.sender_id = $1 AND m.recipient_id = $2) OR (m.sender_id = $2 AND m.recipient_id = $1))`;
  const params = scope === "general" ? [viewerId] : [viewerId, scope];
  const { rows } = await db.query<MessageRow>(`${MESSAGE_SELECT} WHERE ${where} AND m.pinned_at IS NOT NULL ORDER BY m.pinned_at DESC LIMIT 50`, params);
  return rows.map(toMessageResponse);
};

/** Búsqueda por texto, solo entre los mensajes que la persona puede ver (general y sus privados). */
export const searchMessages = async (viewerId: number, text: string, scope: "general" | number | null, limit: number): Promise<MessageResponse[]> => {
  if (text.length < 2) return [];
  const params: unknown[] = [viewerId, likePattern(text)];
  let where = `m.content ILIKE $2 AND (m.recipient_id IS NULL OR m.sender_id = $1 OR m.recipient_id = $1)`;
  if (scope === "general") where += ` AND m.recipient_id IS NULL`;
  else if (scope !== null) {
    params.push(scope);
    where += ` AND ((m.sender_id = $1 AND m.recipient_id = $3) OR (m.sender_id = $3 AND m.recipient_id = $1))`;
  }
  params.push(limit);
  const { rows } = await db.query<MessageRow>(`${MESSAGE_SELECT} WHERE ${where} ORDER BY m.created_at DESC LIMIT $${params.length}`, params);
  return rows.map(toMessageResponse);
};

const MENTION = /(^|[^\w@])@([A-Za-z0-9_.-]{2,40})/g;

/** Nombres de usuario citados con @ en un texto (sin repetir, en minúscula). */
export const mentionedUsernames = (content: string): string[] => {
  const found = new Set<string>();
  for (const m of content.matchAll(MENTION)) found.add((m[2] as string).toLowerCase());
  return [...found];
};

const kindOf = (mime: string | null): MessageKind => (mime === null ? "TEXT" : mime.toLowerCase().startsWith("audio/") ? "AUDIO" : "FILE");

export type SavedMessage = {
  message: MessageResponse;
  /** true si el envío ya existía (mismo clientId): no se vuelve a difundir. */
  duplicate: boolean;
  /** Personas que deben recibirlo (todo el equipo activo menos el autor, o el destinatario). */
  audience: number[];
  mentioned: number[];
};

/**
 * Guarda un mensaje del canal general (recipientId null) o privado. El emisor viene del token. Valida cita, hilo y adjunto
 * contra lo que el emisor puede ver y deja un recibo por cada destinatario; todo en una transacción.
 *  - Responder por privado a un mensaje del grupo: recipientId = autor del mensaje y replyToId = ese mensaje (no se publica).
 *  - Mismo (emisor, clientId) = mismo envío: devuelve el guardado, sin crear otro.
 */
export const saveMessage = async (senderId: number, input: SendMessageInput): Promise<SavedMessage> => {
  const text = input.content.trim();
  if (text.length > MESSAGE_MAX_LENGTH) throw domainError(ErrorCodes.VALIDATION, [{ path: "content", message: `Máximo ${MESSAGE_MAX_LENGTH} caracteres` }]);
  if (text === "" && input.attachmentId === null) throw domainError(ErrorCodes.VALIDATION, [{ path: "content", message: "Escriba un mensaje o adjunte un archivo" }]);
  const { recipientId } = input;
  if (recipientId !== null) {
    if (recipientId === senderId) throw domainError(ErrorCodes.VALIDATION, [{ path: "recipientId", message: "No puede escribirse a sí mismo" }]);
    const recipient = await findUserById(recipientId);
    if (recipient === undefined || !recipient.active) throw domainError(ErrorCodes.USER_NOT_FOUND);
  }

  if (input.clientId !== null) {
    const { rows } = await db.query<{ id: number }>(`SELECT id FROM messages WHERE sender_id = $1 AND client_id = $2`, [senderId, input.clientId]);
    if (rows[0] !== undefined) {
      const existing = await getMessageFor(rows[0].id, senderId);
      if (existing !== undefined) return { message: existing, duplicate: true, audience: [], mentioned: [] };
    }
  }

  const saved = await db.transaction(async (tx) => {
    const sameConversation = (m: { senderId: number; recipientId: number | null }): boolean =>
      recipientId === null ? m.recipientId === null : m.recipientId === null || (canSee(m, senderId) && (m.senderId === recipientId || m.recipientId === recipientId));

    let replyToId: number | null = null;
    if (input.replyToId !== null) {
      const { rows } = await tx.query<{ id: number; senderId: number; recipientId: number | null }>(
        `SELECT id, sender_id AS "senderId", recipient_id AS "recipientId" FROM messages WHERE id = $1`, [input.replyToId]);
      const target = rows[0];
      // Una cita solo puede apuntar a algo que el emisor ve y que el destinatario también puede ver.
      if (target === undefined || !canSee(target, senderId) || !sameConversation(target)) {
        throw domainError(ErrorCodes.VALIDATION, [{ path: "replyToId", message: "Ese mensaje no se puede citar aquí" }]);
      }
      replyToId = target.id;
    }

    let threadRootId: number | null = null;
    if (input.threadRootId !== null) {
      const { rows } = await tx.query<{ id: number; senderId: number; recipientId: number | null; threadRootId: number | null }>(
        `SELECT id, sender_id AS "senderId", recipient_id AS "recipientId", thread_root_id AS "threadRootId" FROM messages WHERE id = $1`, [input.threadRootId]);
      const root = rows[0];
      const sameScope = root !== undefined && canSee(root, senderId) && (recipientId === null ? root.recipientId === null : root.recipientId !== null && (root.senderId === recipientId || root.recipientId === recipientId));
      if (root === undefined || root.threadRootId !== null || !sameScope) {
        throw domainError(ErrorCodes.VALIDATION, [{ path: "threadRootId", message: "Ese hilo no existe en esta conversación" }]);
      }
      threadRootId = root.id;
    }

    let mime: string | null = null;
    if (input.attachmentId !== null) {
      const { rows } = await tx.query<{ mime: string }>(
        `SELECT mime_type AS mime FROM message_attachments WHERE id = $1 AND uploader_id = $2 AND message_id IS NULL FOR UPDATE`, [input.attachmentId, senderId]);
      if (rows[0] === undefined) throw domainError(ErrorCodes.VALIDATION, [{ path: "attachmentId", message: "Adjunto no encontrado o ya usado" }]);
      mime = rows[0].mime;
    }

    const inserted = await tx.query<{ id: number }>(
      `INSERT INTO messages (sender_id, recipient_id, content, kind, reply_to_id, thread_root_id, client_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [senderId, recipientId, text, kindOf(mime), replyToId, threadRootId, input.clientId],
    );
    const id = (inserted.rows[0] as { id: number }).id;
    if (input.attachmentId !== null) await tx.query(`UPDATE message_attachments SET message_id = $1 WHERE id = $2`, [id, input.attachmentId]);

    const audienceRows =
      recipientId === null
        ? (await tx.query<{ id: number }>(`SELECT id FROM users WHERE active AND id <> $1`, [senderId])).rows
        : [{ id: recipientId }];
    const audience = audienceRows.map((r) => r.id);
    if (audience.length > 0) {
      await tx.query(`INSERT INTO message_receipts (message_id, user_id) SELECT $1, UNNEST($2::bigint[])`, [id, audience]);
    }

    // Menciones: solo personas activas del equipo; en un privado, solo el destinatario.
    const names = mentionedUsernames(text);
    let mentioned: number[] = [];
    if (names.length > 0) {
      const { rows } = await tx.query<{ id: number }>(`SELECT id FROM users WHERE active AND id <> $1 AND lower(username) = ANY($2::text[])`, [senderId, names]);
      mentioned = rows.map((r) => r.id).filter((uid) => recipientId === null || uid === recipientId);
      if (mentioned.length > 0) await tx.query(`INSERT INTO message_mentions (message_id, user_id) SELECT $1, UNNEST($2::bigint[])`, [id, mentioned]);
    }
    return { id, audience, mentioned };
  }).catch(async (err: unknown) => {
    // Dos envíos simultáneos con el mismo clientId: gana uno, el otro devuelve el ya guardado.
    if (input.clientId !== null && typeof err === "object" && err !== null && (err as { code?: string }).code === "23505") {
      const { rows } = await db.query<{ id: number }>(`SELECT id FROM messages WHERE sender_id = $1 AND client_id = $2`, [senderId, input.clientId]);
      if (rows[0] !== undefined) return { id: rows[0].id, audience: [] as number[], mentioned: [] as number[], duplicate: true };
    }
    throw err;
  });

  const message = (await getMessageFor(saved.id, senderId)) as MessageResponse;
  return { message, duplicate: "duplicate" in saved, audience: saved.audience, mentioned: saved.mentioned };
};

/** Conversaciones privadas del usuario con el último mensaje y los no leídos de cada una. */
export const listConversations = async (userId: number): Promise<ConversationResponse[]> => {
  const { rows } = await db.query<{
    otherId: number; name: string; username: string; role: ConversationResponse["person"]["role"];
    id: number; content: string; kind: MessageKind; senderId: number; createdAt: Date; unread: number;
  }>(
    `WITH mine AS (
       SELECT m.*, CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END AS other_id
       FROM messages m
       WHERE m.recipient_id IS NOT NULL AND (m.sender_id = $1 OR m.recipient_id = $1)
     ), last AS (
       SELECT DISTINCT ON (other_id) other_id, id, content, kind, sender_id, created_at
       FROM mine ORDER BY other_id, created_at DESC, id DESC
     )
     SELECT l.other_id AS "otherId", (u.first_name || ' ' || u.last_name) AS name, u.username, r.name AS role,
            l.id, l.content, l.kind, l.sender_id AS "senderId", l.created_at AS "createdAt",
            (SELECT COUNT(*) FROM mine x JOIN message_receipts mr ON mr.message_id = x.id AND mr.user_id = $1
              WHERE x.other_id = l.other_id AND x.recipient_id = $1 AND mr.read_at IS NULL)::int AS unread
     FROM last l JOIN users u ON u.id = l.other_id JOIN roles r ON r.id = u.role_id
     ORDER BY l.created_at DESC`,
    [userId],
  );
  return rows.map((f) => ({
    person: { id: f.otherId, name: f.name, username: f.username, role: f.role },
    lastMessage: { id: f.id, content: f.content, kind: f.kind, senderId: f.senderId, createdAt: f.createdAt.toISOString() },
    unread: f.unread,
  }));
};

export type UnreadSummary = { total: number; general: number; privates: Record<string, number>; mentions: number };

/** Sin leer de la persona: total, canal general, cada conversación privada y menciones pendientes. */
export const unreadSummary = async (userId: number): Promise<UnreadSummary> => {
  const { rows } = await db.query<{ scope: string; n: number; mentions: number }>(
    `SELECT CASE WHEN m.recipient_id IS NULL THEN 'general' ELSE m.sender_id::text END AS scope,
            COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM message_mentions mm WHERE mm.message_id = m.id AND mm.user_id = $1))::int AS mentions
     FROM message_receipts r JOIN messages m ON m.id = r.message_id
     WHERE r.user_id = $1 AND r.read_at IS NULL GROUP BY 1`,
    [userId],
  );
  const privates: Record<string, number> = {};
  let general = 0;
  let total = 0;
  let mentions = 0;
  for (const r of rows) {
    total += r.n;
    mentions += r.mentions;
    if (r.scope === "general") general = r.n;
    else privates[r.scope] = r.n;
  }
  return { total, general, privates, mentions };
};

/** Total sin leer (canal general + privados) para el contador del menú. */
export const countUnreadMessages = async (userId: number): Promise<number> => (await unreadSummary(userId)).total;
