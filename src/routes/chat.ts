import express, { Router } from "express";
import { ATTACHMENT_MAX_BYTES } from "../models/index";
import {
  conversationsController,
  directoryController,
  downloadAttachmentController,
  generalHistoryController,
  onlineController,
  pinController,
  pinnedController,
  privateHistoryController,
  readGeneralController,
  readPrivateController,
  receiptsController,
  searchController,
  sendGeneralController,
  sendMessageController,
  sendPrivateController,
  threadController,
  unreadController,
  uploadAttachmentController,
} from "../controllers/chat/index";

/** Chat del equipo: todos los roles autenticados. El envío normal va por Socket.io; estas rutas son historial y respaldo. */
export const chatRouter = Router();
chatRouter.get("/general", generalHistoryController);
chatRouter.post("/general", sendGeneralController);
chatRouter.post("/general/read", readGeneralController);
chatRouter.post("/messages", sendMessageController);
chatRouter.get("/messages/:id/receipts", receiptsController);
chatRouter.get("/messages/:id/thread", threadController);
chatRouter.put("/messages/:id/pin", pinController);
chatRouter.get("/pinned", pinnedController);
chatRouter.get("/search", searchController);
chatRouter.post("/attachments", express.raw({ type: () => true, limit: ATTACHMENT_MAX_BYTES + 1024 }), uploadAttachmentController);
chatRouter.get("/attachments/:id", downloadAttachmentController);
chatRouter.get("/conversations", conversationsController);
chatRouter.get("/people", directoryController);
chatRouter.get("/online", onlineController);
chatRouter.get("/unread", unreadController);
chatRouter.get("/private/:userId", privateHistoryController);
chatRouter.post("/private/:userId", sendPrivateController);
chatRouter.post("/private/:userId/read", readPrivateController);
