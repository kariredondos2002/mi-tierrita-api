import { db } from "../../data-sources/index";
import { ErrorCodes, domainError } from "../../common/index";
import {
  toMessageResponse,
  type ConversationResponse,
  type HistoryQuery,
  type MessagePage,
  type MessageResponse,
  type MessageRow,
} from "../../models/index";
import { findUserById } from "../users/find-user";

const MESSAGE_SELECT = `
  SELECT m.id, m.sender_id AS "senderId", (u.first_name || ' ' || u.last_name) AS "senderName",
         u.username AS "senderUsername", r.name AS "senderRole", m.recipient_id AS "recipientId",
         m.content, m.read_at AS "readAt", m.created_at AS "createdAt"
  FROM messages m JOIN users u ON u.id = m.sender_id JOIN roles r ON r.id = u.role_id`;

const page = async (where: string, params: unknown[], q: HistoryQuery): Promise<MessagePage> => {
  const all = [...params];
  let cond = where;
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

/** Guarda un mensaje del canal general (recipientId null) o privado. El emisor viene del token. */
export const saveMessage = async (senderId: number, content: string, recipientId: number | null = null): Promise<MessageResponse> => {
  const text = content.trim();
  if (text === "" || text.length > 2000) throw domainError(ErrorCodes.VALIDATION, [{ path: "content", message: "Entre 1 y 2000 caracteres" }]);
  if (recipientId !== null) {
    if (recipientId === senderId) throw domainError(ErrorCodes.VALIDATION, [{ path: "recipientId", message: "No puede escribirse a sí mismo" }]);
    const recipient = await findUserById(recipientId);
    if (recipient === undefined || !recipient.active) throw domainError(ErrorCodes.USER_NOT_FOUND);
  }
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3) RETURNING id`,
    [senderId, recipientId, text],
  );
  const saved = await db.query<MessageRow>(`${MESSAGE_SELECT} WHERE m.id = $1`, [rows[0]?.id]);
  return toMessageResponse(saved.rows[0] as MessageRow);
};

/** Historial del canal general, paginado hacia atrás con ?before=. */
export const generalHistory = (q: HistoryQuery): Promise<MessagePage> => page(`m.recipient_id IS NULL`, [], q);

/** Historial de la conversación privada entre dos usuarios. */
export const privateHistory = async (userId: number, otherId: number, q: HistoryQuery): Promise<MessagePage> => {
  const other = await findUserById(otherId);
  if (other === undefined) throw domainError(ErrorCodes.USER_NOT_FOUND);
  return page(
    `((m.sender_id = $1 AND m.recipient_id = $2) OR (m.sender_id = $2 AND m.recipient_id = $1))`,
    [userId, otherId],
    q,
  );
};

/** Conversaciones privadas del usuario con el último mensaje y los no leídos de cada una. */
export const listConversations = async (userId: number): Promise<ConversationResponse[]> => {
  const { rows } = await db.query<{
    otherId: number; name: string; username: string; role: ConversationResponse["person"]["role"];
    id: number; content: string; senderId: number; createdAt: Date; unread: number;
  }>(
    `WITH mine AS (
       SELECT m.*, CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END AS other_id
       FROM messages m
       WHERE m.recipient_id IS NOT NULL AND (m.sender_id = $1 OR m.recipient_id = $1)
     ), last AS (
       SELECT DISTINCT ON (other_id) other_id, id, content, sender_id, created_at
       FROM mine ORDER BY other_id, created_at DESC, id DESC
     )
     SELECT l.other_id AS "otherId", (u.first_name || ' ' || u.last_name) AS name, u.username, r.name AS role,
            l.id, l.content, l.sender_id AS "senderId", l.created_at AS "createdAt",
            (SELECT COUNT(*) FROM mine x WHERE x.other_id = l.other_id AND x.recipient_id = $1 AND x.read_at IS NULL)::int AS unread
     FROM last l JOIN users u ON u.id = l.other_id JOIN roles r ON r.id = u.role_id
     ORDER BY l.created_at DESC`,
    [userId],
  );
  return rows.map((f) => ({
    person: { id: f.otherId, name: f.name, username: f.username, role: f.role },
    lastMessage: { id: f.id, content: f.content, senderId: f.senderId, createdAt: f.createdAt.toISOString() },
    unread: f.unread,
  }));
};

/** Marca como leídos los mensajes que `otherId` le envió a `userId`; devuelve cuántos. */
export const markConversationRead = async (userId: number, otherId: number): Promise<number> => {
  const { rowCount } = await db.query(
    `UPDATE messages SET read_at = now() WHERE sender_id = $1 AND recipient_id = $2 AND read_at IS NULL`,
    [otherId, userId],
  );
  return rowCount ?? 0;
};

/** Total de mensajes privados sin leer (para el contador del menú). */
export const countUnreadMessages = async (userId: number): Promise<number> => {
  const { rows } = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM messages WHERE recipient_id = $1 AND read_at IS NULL`,
    [userId],
  );
  return rows[0]?.n ?? 0;
};
