import type { MessageResponse } from "../../models/index";
import { emitToAll, emitToUsers } from "../../sockets/emitter";
import { markConversationRead, saveMessage } from "./messages";

/**
 * Entrega de mensajes: guarda y difunde. La usan tanto el manejador de Socket.io como
 * la ruta REST de respaldo, así ambos caminos producen exactamente los mismos eventos.
 */
export const sendGeneralMessage = async (senderId: number, content: string): Promise<MessageResponse> => {
  const message = await saveMessage(senderId, content, null);
  emitToAll("chat:mensaje", message);
  return message;
};

export const sendPrivateMessage = async (senderId: number, recipientId: number, content: string): Promise<MessageResponse> => {
  const message = await saveMessage(senderId, content, recipientId);
  emitToUsers([senderId, recipientId], "chat:privado", message);
  return message;
};

/** Confirmación de lectura: avisa al emisor (doble check) y sincroniza las otras pestañas del lector. */
export const readConversation = async (readerId: number, otherId: number): Promise<number> => {
  const updated = await markConversationRead(readerId, otherId);
  if (updated > 0) {
    const payload = { readerId, otherId, at: new Date().toISOString() };
    emitToUsers([otherId, readerId], "chat:leido", payload);
  }
  return updated;
};
