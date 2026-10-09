import { Router } from "express";
import { listNotificationsController, markNotificationsController } from "../controllers/notifications/index";

export const notificationsRouter = Router();
notificationsRouter.get("/", listNotificationsController);
notificationsRouter.post("/read", markNotificationsController);
