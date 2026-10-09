import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { parseHistoryQuery, parseMessageContent } from "../../models/index";
import {
  countUnreadMessages,
  generalHistory,
  listConversations,
  listDirectory,
  privateHistory,
  readConversation,
  sendGeneralMessage,
  sendPrivateMessage,
} from "../../business-logic/chat/index";
import { listOnline } from "../../sockets/presence";

/** GET /api/v1/chat/general?before=&limit= — historial paginado del canal general. */
export const generalHistoryController: RequestHandler = async (req, res) => {
  res.json(await generalHistory(parseHistoryQuery(req.query as Record<string, unknown>)));
};

/** POST /api/v1/chat/general — respaldo REST de chat:mensaje (mismo evento en tiempo real). */
export const sendGeneralController: RequestHandler = async (req, res) => {
  res.status(201).json(await sendGeneralMessage(requireAuth(req).userId, parseMessageContent(req.body)));
};

/** GET /api/v1/chat/conversations — privadas con último mensaje y no leídos. */
export const conversationsController: RequestHandler = async (req, res) => {
  res.json({ conversations: await listConversations(requireAuth(req).userId) });
};

/** GET /api/v1/chat/private/:userId — historial privado paginado. */
export const privateHistoryController: RequestHandler = async (req, res) => {
  res.json(await privateHistory(requireAuth(req).userId, parseId(req.params["userId"], "userId"), parseHistoryQuery(req.query as Record<string, unknown>)));
};

/** POST /api/v1/chat/private/:userId — respaldo REST de chat:privado. */
export const sendPrivateController: RequestHandler = async (req, res) => {
  res.status(201).json(await sendPrivateMessage(requireAuth(req).userId, parseId(req.params["userId"], "userId"), parseMessageContent(req.body)));
};

/** POST /api/v1/chat/private/:userId/read — marca como leída la conversación. */
export const readPrivateController: RequestHandler = async (req, res) => {
  res.json({ updated: await readConversation(requireAuth(req).userId, parseId(req.params["userId"], "userId")) });
};

/** GET /api/v1/chat/people — directorio con estado en línea y última conexión. */
export const directoryController: RequestHandler = async (_req, res) => {
  res.json({ people: await listDirectory() });
};

/** GET /api/v1/chat/online — usuarios con al menos un socket abierto. */
export const onlineController: RequestHandler = (_req, res) => {
  res.json({ people: listOnline() });
};

/** GET /api/v1/chat/unread — total de privados sin leer. */
export const unreadController: RequestHandler = async (req, res) => {
  res.json({ unread: await countUnreadMessages(requireAuth(req).userId) });
};
