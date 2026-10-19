import type { MessageResponse, SendMessageInput } from "../../models/index";
import { forAudience, previewOf } from "../../models/index";
import { emitToAll, emitToUsers } from "../../sockets/emitter";
import { NotificationKinds } from "../../models/index";
import { notifyUsers } from "../notifications/notify";
import { getMessageFor, saveMessage } from "./messages";
import { markDeliveredFor, markDeliveredOnline, markRead, type ReceiptCount } from "./receipts";
import { setPinned } from "./pins";
import type { Role } from "../../security/roles";

/**
 * Entrega de mensajes: guarda y difunde. La usan tanto el manejador de Socket.io como las rutas REST de respaldo, así ambos
 * caminos producen exactamente los mismos eventos. Privacidad: los recibos (quién recibió y quién vio) solo viajan a la sala
 * del autor (`chat:recibos`); el mensaje que se difunde al resto va sin ellos.
 */
export const emitReceipts = (counts: ReceiptCount[]): void => {
  const bySender = new Map<number, ReceiptCount[]>();
  for (const c of counts) bySender.set(c.senderId, [...(bySender.get(c.senderId) ?? []), c]);
  for (const [senderId, list] of bySender) {
    emitToUsers([senderId], "chat:recibos", { updates: list.map((c) => ({ messageId: c.messageId, total: c.total, delivered: c.delivered, read: c.read })) });
  }
};

/** Envío general o privado, con cita, hilo, adjunto y clientId. Devuelve el mensaje para el autor (con sus recibos). */
export const sendMessage = async (senderId: number, input: SendMessageInput): Promise<MessageResponse> => {
  const saved = await saveMessage(senderId, input);
  if (saved.duplicate) return saved.message;
  emitReceipts(await markDeliveredOnline(saved.message.id, saved.audience));
  const mine = (await getMessageFor(saved.message.id, senderId)) as MessageResponse;
  const shared = forAudience(mine);
  if (mine.recipientId === null) emitToAll("chat:mensaje", shared);
  else emitToUsers([senderId, mine.recipientId], "chat:privado", shared);

  const label = previewOf(mine.content, mine.kind);
  if (saved.mentioned.length > 0) {
    void notifyUsers(saved.mentioned, { kind: NotificationKinds.MESSAGE, message: `${mine.sender.name} te mencionó: «${label}»`, link: "/chat" }, senderId)
      .catch((err: unknown) => console.error("No se pudo notificar la mención:", err));
  }
  if (mine.recipientId !== null && !saved.mentioned.includes(mine.recipientId)) {
    void notifyUsers([mine.recipientId], { kind: NotificationKinds.MESSAGE, message: `${mine.sender.name}: «${label}»`, link: "/chat" }, senderId)
      .catch((err: unknown) => console.error("No se pudo notificar el mensaje:", err));
  }
  return mine;
};

export const sendGeneralMessage = (senderId: number, content: string): Promise<MessageResponse> =>
  sendMessage(senderId, { content, recipientId: null, replyToId: null, threadRootId: null, attachmentId: null, clientId: null });

export const sendPrivateMessage = (senderId: number, recipientId: number, content: string): Promise<MessageResponse> =>
  sendMessage(senderId, { content, recipientId, replyToId: null, threadRootId: null, attachmentId: null, clientId: null });

/** Confirmación de lectura de una conversación (privada con otra persona o el canal general). */
export const readConversation = async (readerId: number, scope: "general" | number): Promise<number> => {
  const counts = await markRead(readerId, scope);
  if (counts.length === 0) return 0;
  emitReceipts(counts);
  // Sincroniza las otras pestañas del lector y, en privado, la antigua marca «leído» del chat 1 a 1.
  const payload = { readerId, scope, at: new Date().toISOString() };
  if (scope === "general") emitToUsers([readerId], "chat:leido", payload);
  else emitToUsers([scope, readerId], "chat:leido", { ...payload, otherId: scope });
  return counts.length;
};

/** Al conectarse, todo lo pendiente se marca como entregado y se avisa a los autores. */
export const deliverPending = async (userId: number): Promise<void> => {
  emitReceipts(await markDeliveredFor(userId));
};

/** Fijar o desfijar; el cambio llega a quien ve la conversación (todo el equipo en el general; los dos en un privado). */
export const pinMessage = async (messageId: number, userId: number, role: Role, pinned: boolean): Promise<MessageResponse> => {
  const message = await setPinned(messageId, userId, role, pinned);
  const shared = forAudience(message);
  if (message.recipientId === null) emitToAll("chat:fijado", shared);
  else emitToUsers([message.sender.id, message.recipientId], "chat:fijado", shared);
  return message;
};
