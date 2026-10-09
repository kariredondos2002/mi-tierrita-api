import { db } from "../../data-sources/index";
import type { DirectoryEntry, PersonSummary } from "../../models/index";
import { isOnline } from "../../sockets/presence";

/** Directorio del equipo para el chat: personas activas con su estado y última conexión. */
export const listDirectory = async (): Promise<DirectoryEntry[]> => {
  const { rows } = await db.query<PersonSummary & { lastSeenAt: Date | null }>(
    `SELECT u.id, (u.first_name || ' ' || u.last_name) AS name, u.username, r.name AS role, u.last_seen_at AS "lastSeenAt"
     FROM users u JOIN roles r ON r.id = u.role_id WHERE u.active ORDER BY u.first_name, u.last_name`,
  );
  return rows.map((r) => ({ ...r, lastSeenAt: r.lastSeenAt === null ? null : r.lastSeenAt.toISOString(), online: isOnline(r.id) }));
};

export const findPerson = async (userId: number): Promise<PersonSummary | undefined> => {
  const { rows } = await db.query<PersonSummary>(
    `SELECT u.id, (u.first_name || ' ' || u.last_name) AS name, u.username, r.name AS role
     FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
    [userId],
  );
  return rows[0];
};

/** Última conexión: se guarda cuando el usuario cierra su último socket. */
export const touchLastSeen = async (userId: number): Promise<string> => {
  const { rows } = await db.query<{ at: Date }>(`UPDATE users SET last_seen_at = now() WHERE id = $1 RETURNING last_seen_at AS at`, [userId]);
  return (rows[0]?.at ?? new Date()).toISOString();
};
