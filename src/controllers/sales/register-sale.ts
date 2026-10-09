import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { parseCreateSale } from "../../models/index";
import { registerSale } from "../../business-logic/sales/index";
import { onSaleRegistered } from "../../business-logic/notifications/index";

/** POST /api/v1/sales — ADMIN, SALES (CU-09, CU-08, CU-11). */
export const registerSaleController: RequestHandler = async (req, res) => {
  const { userId } = requireAuth(req);
  const sale = await registerSale(userId, parseCreateSale(req.body));
  onSaleRegistered(sale, userId);
  res.status(201).json(sale);
};
