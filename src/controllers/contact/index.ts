import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { parseContact } from "../../models/index";
import { createContactMessage, listContactMessages, markContactHandled } from "../../business-logic/contact/index";

/** POST /api/v1/contact — PÚBLICA (formulario de la página de inicio), con límite de envíos. */
export const createContactController: RequestHandler = async (req, res) => {
  const saved = await createContactMessage(parseContact(req.body));
  res.status(201).json({ id: saved.id, createdAt: saved.createdAt });
};

/** GET /api/v1/contact — ADMIN. */
export const listContactController: RequestHandler = async (_req, res) => {
  res.json({ items: await listContactMessages() });
};

/** POST /api/v1/contact/:id/handled — ADMIN. */
export const handleContactController: RequestHandler = async (req, res) => {
  await markContactHandled(parseId(req.params["id"]));
  res.status(204).send();
};
