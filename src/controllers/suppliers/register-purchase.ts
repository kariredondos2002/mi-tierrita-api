import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { parseCreatePurchase } from "../../models/index";
import { registerPurchase } from "../../business-logic/suppliers/index";
import { onStockReceived } from "../../business-logic/notifications/index";

/** POST /api/v1/suppliers/:id/purchases — ADMIN, WAREHOUSE (CU-13). */
export const registerPurchaseController: RequestHandler = async (req, res) => {
  const batch = await registerPurchase(parseId(req.params["id"]), parseCreatePurchase(req.body));
  onStockReceived(batch.productName, batch.quantity, requireAuth(req).userId, batch.supplierName ?? undefined);
  res.status(201).json(batch);
};
