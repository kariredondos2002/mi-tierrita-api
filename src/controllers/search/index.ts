import type { RequestHandler } from "express";
import { queryString } from "../../common/index";
import { requireAuth } from "../../security/index";
import { globalSearch } from "../../business-logic/search/index";

/** GET /api/v1/search?q= — búsqueda global según el rol (Ctrl + K). */
export const searchController: RequestHandler = async (req, res) => {
  res.json(await globalSearch(requireAuth(req).role, queryString(req.query["q"], 80) ?? ""));
};
