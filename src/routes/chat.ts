import { Router } from "express";
import {
  conversationsController,
  directoryController,
  generalHistoryController,
  onlineController,
  privateHistoryController,
  readPrivateController,
  sendGeneralController,
  sendPrivateController,
  unreadController,
} from "../controllers/chat/index";

/** Chat del equipo: todos los roles autenticados. El envío normal va por Socket.io; estas rutas son historial y respaldo. */
export const chatRouter = Router();
chatRouter.get("/general", generalHistoryController);
chatRouter.post("/general", sendGeneralController);
chatRouter.get("/conversations", conversationsController);
chatRouter.get("/people", directoryController);
chatRouter.get("/online", onlineController);
chatRouter.get("/unread", unreadController);
chatRouter.get("/private/:userId", privateHistoryController);
chatRouter.post("/private/:userId", sendPrivateController);
chatRouter.post("/private/:userId/read", readPrivateController);
