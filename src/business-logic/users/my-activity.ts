import { db } from "../../data-sources/index";
import type { ActivityItem, MyActivity } from "../../models/index";

/** Mi actividad (pantalla Mi perfil): últimas 15 acciones propias y conteos de 30 días, desde la auditoría. */
export const myActivity = async (userId: number): Promise<MyActivity> => {
  const [items, counts, last] = await Promise.all([
    db.query<Omit<ActivityItem, "createdAt"> & { createdAt: Date }>(
      `SELECT id, method, resource, detail, created_at AS "createdAt" FROM audits WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 15`,
      [userId],
    ),
    db.query<MyActivity["last30Days"]>(
      `SELECT count(*) FILTER (WHERE method IN ('POST','PUT','PATCH','DELETE'))::int AS writes,
              count(*) FILTER (WHERE method = 'EXPORT')::int AS exports,
              count(*) FILTER (WHERE method = 'SIGNIN')::int AS signins,
              count(*) FILTER (WHERE method = 'POST' AND resource = '/api/v1/sales')::int AS sales,
              count(*) FILTER (WHERE method = 'POST' AND resource LIKE '%/payments')::int AS payments,
              count(*) FILTER (WHERE method = 'POST' AND (resource LIKE '%/batches' OR resource LIKE '%/purchases'))::int AS batches
       FROM audits WHERE user_id = $1 AND created_at >= now() - interval '30 days'`,
      [userId],
    ),
    db.query<{ at: Date }>(`SELECT created_at AS at FROM audits WHERE user_id = $1 AND method = 'SIGNIN' ORDER BY created_at DESC OFFSET 1 LIMIT 1`, [userId]),
  ]);
  return {
    items: items.rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    last30Days: counts.rows[0] ?? { writes: 0, exports: 0, signins: 0, sales: 0, payments: 0, batches: 0 },
    lastSigninAt: last.rows[0] ? last.rows[0].at.toISOString() : null,
  };
};
