import type { RequestHandler } from "express";
import { getAuth } from "../security/index";
import { broadcastChange } from "../business-logic/notifications/index";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
/** Recursos de negocio cuyas escrituras refrescan las pantallas abiertas. El chat y las notificaciones tienen sus propios eventos. */
const LIVE_RESOURCES = new Set(["products", "categories", "batches", "suppliers", "customers", "sales", "financial", "users"]);

/**
 * Actualización en vivo (v4): después de cada escritura exitosa emite `datos:cambio`
 * con el recurso tocado, y la aplicación invalida esas consultas en todas las
 * pestañas abiertas. Mismo enganche que la auditoría: al terminar la respuesta.
 */
export const liveEventsMiddleware: RequestHandler = (req, res, next) => {
  res.on("finish", () => {
    if (!WRITE_METHODS.has(req.method) || res.statusCode >= 400) return;
    const resource = (req.originalUrl.split("?")[0] ?? "").replace(/^\/api\/v1\//, "").split("/")[0] ?? "";
    if (!LIVE_RESOURCES.has(resource)) return;
    broadcastChange(resource, getAuth(req)?.userId);
  });
  next();
};
