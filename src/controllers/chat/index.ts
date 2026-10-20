import type { RequestHandler } from "express";
import { ErrorCodes, domainError, parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { ATTACHMENT_MAX_BYTES, parseChatSearch, parseHistoryQuery, parseSendMessage } from "../../models/index";
import {
  generalHistory,
  listConversations,
  listDirectory,
  pinMessage,
  pinnedIn,
  privateHistory,
  readAttachment,
  readConversation,
  receiptDetail,
  saveAttachment,
  searchMessages,
  sendMessage,
  threadOf,
  unreadSummary,
} from "../../business-logic/chat/index";
import { listOnline } from "../../sockets/presence";

/** GET /api/v1/chat/general?before=&limit= — historial paginado del canal general (sin respuestas de hilo). */
export const generalHistoryController: RequestHandler = async (req, res) => {
  res.json(await generalHistory(requireAuth(req).userId, parseHistoryQuery(req.query as Record<string, unknown>)));
};

/** POST /api/v1/chat/general — respaldo REST de chat:mensaje (mismo evento en tiempo real). */
export const sendGeneralController: RequestHandler = async (req, res) => {
  res.status(201).json(await sendMessage(requireAuth(req).userId, { ...parseSendMessage(req.body), recipientId: null }));
};

/** POST /api/v1/chat/messages — envío completo: general o privado, con cita, hilo, adjunto y clientId. */
export const sendMessageController: RequestHandler = async (req, res) => {
  res.status(201).json(await sendMessage(requireAuth(req).userId, parseSendMessage(req.body)));
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
  res.status(201).json(await sendMessage(requireAuth(req).userId, { ...parseSendMessage(req.body), recipientId: parseId(req.params["userId"], "userId") }));
};

/** POST /api/v1/chat/private/:userId/read — marca como leída la conversación. */
export const readPrivateController: RequestHandler = async (req, res) => {
  res.json({ updated: await readConversation(requireAuth(req).userId, parseId(req.params["userId"], "userId")) });
};

/** POST /api/v1/chat/general/read — marca como leído el canal general. */
export const readGeneralController: RequestHandler = async (req, res) => {
  res.json({ updated: await readConversation(requireAuth(req).userId, "general") });
};

/** GET /api/v1/chat/messages/:id/receipts — quién recibió, quién vio y quién sigue pendiente. Solo el autor. */
export const receiptsController: RequestHandler = async (req, res) => {
  res.json(await receiptDetail(parseId(req.params["id"]), requireAuth(req).userId));
};

/** PUT /api/v1/chat/messages/:id/pin {pinned} — fijar o desfijar. */
export const pinController: RequestHandler = async (req, res) => {
  const auth = requireAuth(req);
  const pinned = (req.body as { pinned?: unknown } | undefined)?.pinned;
  if (typeof pinned !== "boolean") throw domainError(ErrorCodes.VALIDATION, [{ path: "pinned", message: "Debe ser verdadero o falso" }]);
  res.json(await pinMessage(parseId(req.params["id"]), auth.userId, auth.role, pinned));
};

/** GET /api/v1/chat/messages/:id/thread — mensaje raíz y sus respuestas. */
export const threadController: RequestHandler = async (req, res) => {
  res.json(await threadOf(parseId(req.params["id"]), requireAuth(req).userId));
};

/** GET /api/v1/chat/pinned?scope=general|<id> — mensajes fijados de una conversación. */
export const pinnedController: RequestHandler = async (req, res) => {
  const scope = parseChatSearch({ scope: req.query["scope"] }).scope ?? "general";
  res.json({ messages: await pinnedIn(requireAuth(req).userId, scope) });
};

/** GET /api/v1/chat/search?q=&scope=&limit= — busca solo entre lo que la persona puede ver. */
export const searchController: RequestHandler = async (req, res) => {
  const { q, scope, limit } = parseChatSearch(req.query as Record<string, unknown>);
  res.json({ messages: await searchMessages(requireAuth(req).userId, q, scope, limit) });
};

/** POST /api/v1/chat/attachments — cuerpo binario; cabeceras X-File-Name (codificado) y X-Duration-Ms (audio). */
export const uploadAttachmentController: RequestHandler = async (req, res) => {
  const body = req.body as unknown;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    throw domainError(ErrorCodes.VALIDATION, [{ path: "file", message: `Envíe el archivo en el cuerpo (máximo ${ATTACHMENT_MAX_BYTES / 1024 / 1024} MB)` }]);
  }
  const rawName = req.get("x-file-name");
  let fileName = "archivo";
  try {
    fileName = rawName === undefined ? "archivo" : decodeURIComponent(rawName);
  } catch {
    fileName = "archivo";
  }
  const duration = Number(req.get("x-duration-ms"));
  res.status(201).json(await saveAttachment(requireAuth(req).userId, fileName, req.get("content-type") ?? "", body, Number.isInteger(duration) ? duration : null));
};

/** GET /api/v1/chat/attachments/:id — descarga con permisos (audio e imagen en línea; lo demás como descarga). */
export const downloadAttachmentController: RequestHandler = async (req, res) => {
  const file = await readAttachment(parseId(req.params["id"]), requireAuth(req).userId);
  const inline = /^(audio|image)\//.test(file.mimeType);
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(file.data);
};

/** GET /api/v1/chat/people — directorio con estado en línea y última conexión. */
export const directoryController: RequestHandler = async (_req, res) => {
  res.json({ people: await listDirectory() });
};

/** GET /api/v1/chat/online — usuarios con al menos un socket abierto. */
export const onlineController: RequestHandler = (_req, res) => {
  res.json({ people: listOnline() });
};

/** GET /api/v1/chat/unread — sin leer: total, canal general, cada privado y menciones. */
export const unreadController: RequestHandler = async (req, res) => {
  const s = await unreadSummary(requireAuth(req).userId);
  res.json({ unread: s.total, general: s.general, privates: s.privates, mentions: s.mentions });
};
