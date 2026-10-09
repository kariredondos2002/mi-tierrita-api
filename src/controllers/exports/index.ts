import type { RequestHandler, Response } from "express";
import { addDaysIso, parseId, parsePageRequest, queryDate, queryInt, todayIso } from "../../common/index";
import { requireAuth, Roles } from "../../security/index";
import { AuditMethods } from "../../models/index";
import { recordAudit, listAudits } from "../../business-logic/audits/index";
import { findPerson } from "../../business-logic/chat/index";
import { exportInventory, exportReceivables, exportSales, exportScenario, type ExportFile, type ExportFormat } from "../../business-logic/exports/report-files";
import { DEFAULT_OVERDUE_DAYS } from "../../business-logic/customers/index";
import type { Request } from "express";

const formatOf = (raw: unknown): ExportFormat => (raw === "xlsx" || raw === "excel" ? "xlsx" : "pdf");

/** Datos de quien genera el archivo: van impresos en el PDF/Excel y en la auditoría. */
const generator = async (req: Request) => {
  const auth = requireAuth(req);
  const person = await findPerson(auth.userId);
  return { auth, by: { name: person?.name ?? auth.username, username: auth.username } };
};

/** Envía el archivo y registra EXPORT en la auditoría (quién, qué reporte, con qué filtros y cuándo). */
const send = async (req: Request, res: Response, userId: number, file: ExportFile): Promise<void> => {
  await recordAudit({ userId, method: AuditMethods.EXPORT, resource: (req.originalUrl.split("?")[0] ?? req.originalUrl), detail: file.description });
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  res.send(file.body);
};

/** GET /api/v1/reports/sales/export?format=pdf|xlsx&from&to&groupBy — ADMIN, SALES. */
export const exportSalesController: RequestHandler = async (req, res) => {
  const { auth, by } = await generator(req);
  const to = queryDate(req.query["to"], todayIso());
  const from = queryDate(req.query["from"], addDaysIso(to, -29));
  const groupBy = req.query["groupBy"] === "product" ? "product" : "day";
  await send(req, res, auth.userId, await exportSales(from, to, groupBy, formatOf(req.query["format"]), by));
};

/** GET /api/v1/reports/inventory/export?format&days — ADMIN. */
export const exportInventoryController: RequestHandler = async (req, res) => {
  const { auth, by } = await generator(req);
  await send(req, res, auth.userId, await exportInventory(queryInt(req.query["days"], 30), formatOf(req.query["format"]), by));
};

/** GET /api/v1/reports/receivables/export?format&overdueDays — ADMIN. */
export const exportReceivablesController: RequestHandler = async (req, res) => {
  const { auth, by } = await generator(req);
  await send(req, res, auth.userId, await exportReceivables(queryInt(req.query["overdueDays"], DEFAULT_OVERDUE_DAYS), formatOf(req.query["format"]), by));
};

/** GET /api/v1/financial/scenarios/:id/export?format — ADMIN. */
export const exportScenarioController: RequestHandler = async (req, res) => {
  const { auth, by } = await generator(req);
  await send(req, res, auth.userId, await exportScenario(parseId(req.params["id"]), formatOf(req.query["format"]), by));
};

/**
 * GET /api/v1/reports/exports — historial de reportes generados (quién, cuál, cuándo).
 * El administrador ve los de todos; los demás roles, solo los propios.
 */
export const listExportsController: RequestHandler = async (req, res) => {
  const auth = requireAuth(req);
  res.json(await listAudits(parsePageRequest(req.query), { method: AuditMethods.EXPORT, userId: auth.role === Roles.ADMIN ? undefined : auth.userId }));
};
