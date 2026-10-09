import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { voidSale } from "../../business-logic/sales/index";
import { onSaleVoided } from "../../business-logic/notifications/index";

/** POST /api/v1/sales/:id/void — ADMIN (RF-03.4). */
export const voidSaleController: RequestHandler = async (req, res) => {
  const { userId } = requireAuth(req);
  const sale = await voidSale(parseId(req.params["id"]), userId);
  onSaleVoided(sale, userId);
  res.json(sale);
};
