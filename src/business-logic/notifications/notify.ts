import { db } from "../../data-sources/index";
import { toNotificationResponse, type NotificationInput, type NotificationRow } from "../../models/index";
import type { Role } from "../../security/roles";
import { emitToUsers } from "../../sockets/emitter";

const COLUMNS = `id, kind, message, link, read, created_at AS "createdAt"`;

/**
 * Guarda una notificación por destinatario y la empuja en tiempo real con el evento
 * `notificacion` a la sala `usuario:<id>`. El autor de la acción no se notifica a sí mismo.
 */
export const notifyUsers = async (userIds: number[], input: NotificationInput, excludeId?: number): Promise<number> => {
  const targets = [...new Set(userIds)].filter((id) => id !== excludeId);
  for (const userId of targets) {
    const { rows } = await db.query<NotificationRow>(
      `INSERT INTO notifications (user_id, kind, message, link) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
      [userId, input.kind, input.message.slice(0, 300), input.link ?? null],
    );
    const row = rows[0];
    if (row !== undefined) emitToUsers([userId], "notificacion", toNotificationResponse(row));
  }
  return targets.length;
};

/** Notifica a todos los usuarios activos de uno o varios roles. */
export const notifyRoles = async (roles: Role[], input: NotificationInput, excludeId?: number): Promise<number> => {
  const { rows } = await db.query<{ id: number }>(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE u.active AND r.name = ANY($1::text[])`,
    [roles],
  );
  return notifyUsers(rows.map((r) => r.id), input, excludeId);
};
