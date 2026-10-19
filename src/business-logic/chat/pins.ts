import { db } from "../../data-sources/index";
import { ErrorCodes, domainError } from "../../common/index";
import type { MessageResponse } from "../../models/index";
import { Roles, type Role } from "../../security/roles";
import { getMessageFor } from "./messages";

/**
 * Fijar o desfijar un mensaje importante. Permisos: en el canal general solo el ADMIN (el tablón del equipo);
 * en un privado, cualquiera de los dos participantes. Quien no ve el mensaje recibe «no existe».
 */
export const setPinned = async (messageId: number, userId: number, role: Role, pinned: boolean): Promise<MessageResponse> => {
  const message = await getMessageFor(messageId, userId);
  if (message === undefined) throw domainError(ErrorCodes.MESSAGE_NOT_FOUND);
  if (message.recipientId === null && role !== Roles.ADMIN) throw domainError(ErrorCodes.ROLE_INSUFFICIENT);
  if (message.threadRootId !== null) throw domainError(ErrorCodes.VALIDATION, [{ path: "messageId", message: "Solo se fijan mensajes del chat, no respuestas de hilo" }]);
  await db.query(
    pinned
      ? `UPDATE messages SET pinned_at = now(), pinned_by = $2 WHERE id = $1`
      : `UPDATE messages SET pinned_at = NULL, pinned_by = NULL WHERE id = $1`,
    pinned ? [messageId, userId] : [messageId],
  );
  return (await getMessageFor(messageId, userId)) as MessageResponse;
};
