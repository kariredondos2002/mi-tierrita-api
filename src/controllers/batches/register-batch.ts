import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { parseCreateBatch } from "../../models/index";
import { registerBatch } from "../../business-logic/batches/index";
import { onStockReceived } from "../../business-logic/notifications/index";

/** POST /api/v1/products/:id/batches — ADMIN, WAREHOUSE (CU-06). */
export const registerBatchController: RequestHandler = async (req, res) => {
  const input = parseCreateBatch(req.body);
  const batch = await registerBatch({ productId: parseId(req.params["id"]), ...input });
  onStockReceived(batch.productName, batch.quantity, requireAuth(req).userId, batch.supplierName ?? undefined);
  res.status(201).json(batch);
};
