import { db } from "../../data-sources/index";
import { toNotificationResponse, type NotificationResponse, type NotificationRow } from "../../models/index";

/** Últimas notificaciones del usuario y cuántas siguen sin leer. */
export const listNotifications = async (userId: number, limit = 30): Promise<{ notifications: NotificationResponse[]; unread: number }> => {
  const [list, count] = await Promise.all([
    db.query<NotificationRow>(
      `SELECT id, kind, message, link, read, created_at AS "createdAt" FROM notifications
       WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
      [userId, limit],
    ),
    db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND NOT read`, [userId]),
  ]);
  return { notifications: list.rows.map(toNotificationResponse), unread: count.rows[0]?.n ?? 0 };
};

/** Marca como leídas las indicadas (o todas si no se indican). Solo las del propio usuario. */
export const markNotificationsRead = async (userId: number, ids?: number[]): Promise<number> => {
  const { rowCount } = ids !== undefined && ids.length > 0
    ? await db.query(`UPDATE notifications SET read = TRUE WHERE user_id = $1 AND NOT read AND id = ANY($2::bigint[])`, [userId, ids])
    : await db.query(`UPDATE notifications SET read = TRUE WHERE user_id = $1 AND NOT read`, [userId]);
  return rowCount ?? 0;
};
