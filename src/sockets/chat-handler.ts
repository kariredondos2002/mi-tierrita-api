import type { Server, Socket } from "socket.io";
import { ErrorCodes, domainError, isDomainError } from "../common/index";
import type { PersonSummary } from "../models/index";
import { MESSAGE_MAX_LENGTH } from "../models/index";
import {
  generalHistory,
  readConversation,
  sendGeneralMessage,
  sendPrivateMessage,
  touchLastSeen,
} from "../business-logic/chat/index";
import { Rooms } from "./emitter";
import { addSocket, listOnline, removeSocket } from "./presence";

/**
 * Eventos del chat (contrato documentado en el README, sección «Eventos Socket.io»).
 *
 * servidor → cliente: chat:historial, chat:mensaje, chat:privado, chat:leido, chat:escribiendo,
 *                     usuarios:conectados, usuario:conectado, usuario:desconectado,
 *                     notificacion, datos:cambio
 * cliente → servidor (con ack {ok, ...} o {ok:false, error}):
 *                     chat:mensaje (texto), chat:privado {recipientId, content},
 *                     chat:leido {userId}, chat:escribiendo {recipientId|null, typing}
 */
export type Ack = (response: { ok: true; [k: string]: unknown } | { ok: false; error: string }) => void;

/** Ejecuta el manejador y responde por el ack; un error de dominio viaja como su código. */
const safely = (ack: unknown, fn: () => Promise<Record<string, unknown>>): void => {
  const reply: Ack = typeof ack === "function" ? (ack as Ack) : () => undefined;
  fn()
    .then((data) => reply({ ok: true, ...data }))
    .catch((err: unknown) => {
      if (isDomainError(err)) return reply({ ok: false, error: err.code });
      console.error("Error en un evento de Socket.io:", err);
      return reply({ ok: false, error: "500" });
    });
};

/** Límite de envío por socket: 12 mensajes cada 10 segundos. */
const createLimiter = (max = 12, windowMs = 10_000) => {
  let stamps: number[] = [];
  return () => {
    const now = Date.now();
    stamps = stamps.filter((t) => now - t < windowMs);
    if (stamps.length >= max) return false;
    stamps.push(now);
    return true;
  };
};

const text = (value: unknown): string => (typeof value === "string" ? value.slice(0, MESSAGE_MAX_LENGTH + 1) : "");

export const registerChatHandlers = (io: Server, socket: Socket): void => {
  const me = socket.data.person as PersonSummary;
  const allow = createLimiter();

  // Presencia: la primera pestaña del usuario lo anuncia a los demás.
  if (addSocket(me, socket.id)) socket.to(Rooms.GENERAL).emit("usuario:conectado", me);
  socket.emit("usuarios:conectados", listOnline());

  // Historial reciente del canal general al conectar (y al reconectar).
  void generalHistory({ limit: 40 })
    .then((page) => socket.emit("chat:historial", page))
    .catch((err: unknown) => console.error("No se pudo enviar el historial:", err));

  socket.on("chat:mensaje", (content: unknown, ack: unknown) =>
    safely(ack, async () => {
      if (!allow()) throw domainError(ErrorCodes.TOO_MANY_ATTEMPTS);
      return { message: await sendGeneralMessage(me.id, text(content)) };
    }),
  );

  socket.on("chat:privado", (payload: { recipientId?: unknown; content?: unknown } | undefined, ack: unknown) =>
    safely(ack, async () => {
      if (!allow()) throw domainError(ErrorCodes.TOO_MANY_ATTEMPTS);
      const recipientId = Number(payload?.recipientId);
      if (!Number.isInteger(recipientId) || recipientId <= 0) throw domainError(ErrorCodes.VALIDATION, [{ path: "recipientId", message: "Debe ser un entero positivo" }]);
      return { message: await sendPrivateMessage(me.id, recipientId, text(payload?.content)) };
    }),
  );

  socket.on("chat:leido", (payload: { userId?: unknown } | undefined, ack: unknown) =>
    safely(ack, async () => {
      const otherId = Number(payload?.userId);
      if (!Number.isInteger(otherId) || otherId <= 0) return { updated: 0 };
      return { updated: await readConversation(me.id, otherId) };
    }),
  );

  // «Está escribiendo…»: sin persistencia; al canal general o solo al destinatario.
  socket.on("chat:escribiendo", (payload: { recipientId?: unknown; typing?: unknown } | undefined) => {
    const recipientId = Number(payload?.recipientId);
    const event = { from: me, recipientId: Number.isInteger(recipientId) && recipientId > 0 ? recipientId : null, typing: payload?.typing !== false };
    if (event.recipientId !== null) socket.to(Rooms.user(event.recipientId)).emit("chat:escribiendo", event);
    else socket.to(Rooms.GENERAL).emit("chat:escribiendo", event);
  });

  socket.on("disconnect", () => {
    if (!removeSocket(me.id, socket.id)) return;
    void touchLastSeen(me.id)
      .then((lastSeenAt) => io.to(Rooms.GENERAL).emit("usuario:desconectado", { id: me.id, lastSeenAt }))
      .catch((err: unknown) => console.error("No se pudo guardar la última conexión:", err));
  });
};
