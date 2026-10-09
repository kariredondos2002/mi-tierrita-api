import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { parseMarkNotifications } from "../../models/index";
import { listNotifications, markNotificationsRead } from "../../business-logic/notifications/index";

/** GET /api/v1/notifications — últimas 30 y el total sin leer. */
export const listNotificationsController: RequestHandler = async (req, res) => {
  res.json(await listNotifications(requireAuth(req).userId));
};

/** POST /api/v1/notifications/read — { ids?: number[] }; sin ids marca todas. */
export const markNotificationsController: RequestHandler = async (req, res) => {
  const { ids } = parseMarkNotifications(req.body);
  res.json({ updated: await markNotificationsRead(requireAuth(req).userId, ids) });
};
