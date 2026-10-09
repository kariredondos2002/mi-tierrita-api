import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { myActivity } from "../../business-logic/users/index";

/** GET /api/v1/users/me/activity — autenticado: mis últimas acciones y conteos de 30 días. */
export const myActivityController: RequestHandler = async (req, res) => {
  res.json(await myActivity(requireAuth(req).userId));
};
