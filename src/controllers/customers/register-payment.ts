import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { parseCreatePayment } from "../../models/index";
import { findCustomerById, registerPayment } from "../../business-logic/customers/index";
import { onPaymentRegistered } from "../../business-logic/notifications/index";

/** POST /api/v1/customers/:id/payments — ADMIN, SALES (CU-12). */
export const registerPaymentController: RequestHandler = async (req, res) => {
  const { userId } = requireAuth(req);
  const customerId = parseId(req.params["id"]);
  const payment = await registerPayment(customerId, userId, parseCreatePayment(req.body));
  const customer = await findCustomerById(customerId);
  onPaymentRegistered(customer?.name ?? `cliente #${customerId}`, payment.amount, userId);
  res.status(201).json(payment);
};
