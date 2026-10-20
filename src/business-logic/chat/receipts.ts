import { db } from "../../data-sources/index";
import { ErrorCodes, domainError } from "../../common/index";
import type { PersonSummary } from "../../models/index";
import { isOnline } from "../../sockets/presence";

/** Estado de un mensaje propio, visto por su autor: cuántos recibieron y cuántos vieron. */
export type ReceiptCount = { messageId: number; senderId: number; total: number; delivered: number; read: number };

const counts = async (messageIds: number[]): Promise<ReceiptCount[]> => {
  if (messageIds.length === 0) return [];
  const { rows } = await db.query<ReceiptCount>(
    `SELECT m.id AS "messageId", m.sender_id AS "senderId", COUNT(r.user_id)::int AS total,
            COUNT(r.delivered_at)::int AS delivered, COUNT(r.read_at)::int AS read
     FROM messages m JOIN message_receipts r ON r.message_id = m.id
     WHERE m.id = ANY($1::bigint[]) GROUP BY m.id, m.sender_id`,
    [messageIds],
  );
  return rows;
};

export const receiptCounts = counts;

/** Marca como entregados los mensajes pendientes de una persona (al conectarse). Devuelve los conteos nuevos para avisar a sus autores. */
export const markDeliveredFor = async (userId: number): Promise<ReceiptCount[]> => {
  const { rows } = await db.query<{ messageId: number }>(
    `UPDATE message_receipts SET delivered_at = now() WHERE user_id = $1 AND delivered_at IS NULL RETURNING message_id AS "messageId"`,
    [userId],
  );
  return counts(rows.map((r) => r.messageId));
};

/** Entrega inmediata de un mensaje recién enviado a quienes ya están en línea. */
export const markDeliveredOnline = async (messageId: number, audience: number[]): Promise<ReceiptCount[]> => {
  const online = audience.filter(isOnline);
  if (online.length === 0) return [];
  await db.query(
    `UPDATE message_receipts SET delivered_at = now() WHERE message_id = $1 AND user_id = ANY($2::bigint[]) AND delivered_at IS NULL`,
    [messageId, online],
  );
  return counts([messageId]);
};

/**
 * Marca como vistos los mensajes de una conversación que la persona tenía pendientes: "general" o la otra persona.
 * Un mensaje visto también cuenta como entregado. En los privados se sincroniza el `read_at` histórico del mensaje.
 */
export const markRead = async (readerId: number, scope: "general" | number): Promise<ReceiptCount[]> => {
  const cond = scope === "general" ? `m.recipient_id IS NULL` : `m.sender_id = $2 AND m.recipient_id = $1`;
  const params = scope === "general" ? [readerId] : [readerId, scope];
  const { rows } = await db.query<{ messageId: number }>(
    `UPDATE message_receipts r SET read_at = now(), delivered_at = COALESCE(r.delivered_at, now())
     FROM messages m WHERE m.id = r.message_id AND r.user_id = $1 AND r.read_at IS NULL AND ${cond}
     RETURNING r.message_id AS "messageId"`,
    params,
  );
  const ids = rows.map((r) => r.messageId);
  if (scope !== "general" && ids.length > 0) await db.query(`UPDATE messages SET read_at = now() WHERE id = ANY($1::bigint[]) AND read_at IS NULL`, [ids]);
  return counts(ids);
};

export type ReceiptDetail = {
  messageId: number;
  total: number;
  delivered: number;
  read: number;
  people: { person: PersonSummary; deliveredAt: string | null; readAt: string | null; status: "PENDING" | "DELIVERED" | "READ" }[];
};

/** Detalle por persona (quién recibió, quién vio, quién sigue pendiente). Solo lo ve el autor del mensaje. */
export const receiptDetail = async (messageId: number, viewerId: number): Promise<ReceiptDetail> => {
  const found = await db.query<{ senderId: number }>(`SELECT sender_id AS "senderId" FROM messages WHERE id = $1`, [messageId]);
  const msg = found.rows[0];
  if (msg === undefined) throw domainError(ErrorCodes.MESSAGE_NOT_FOUND);
  if (msg.senderId !== viewerId) throw domainError(ErrorCodes.ROLE_INSUFFICIENT);
  const { rows } = await db.query<PersonSummary & { deliveredAt: Date | null; readAt: Date | null }>(
    `SELECT u.id, (u.first_name || ' ' || u.last_name) AS name, u.username, ro.name AS role, r.delivered_at AS "deliveredAt", r.read_at AS "readAt"
     FROM message_receipts r JOIN users u ON u.id = r.user_id JOIN roles ro ON ro.id = u.role_id
     WHERE r.message_id = $1 ORDER BY r.read_at NULLS LAST, r.delivered_at NULLS LAST, u.first_name`,
    [messageId],
  );
  const people = rows.map((r) => ({
    person: { id: r.id, name: r.name, username: r.username, role: r.role },
    deliveredAt: r.deliveredAt === null ? null : r.deliveredAt.toISOString(),
    readAt: r.readAt === null ? null : r.readAt.toISOString(),
    status: (r.readAt !== null ? "READ" : r.deliveredAt !== null ? "DELIVERED" : "PENDING") as "PENDING" | "DELIVERED" | "READ",
  }));
  return { messageId, total: people.length, delivered: people.filter((p) => p.deliveredAt !== null).length, read: people.filter((p) => p.readAt !== null).length, people };
};
