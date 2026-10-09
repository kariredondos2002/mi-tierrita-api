import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { config } from "../server/config";
import { verifyAccessToken } from "../security/index";
import { findUserById } from "../business-logic/users/find-user";
import { findPerson } from "../business-logic/chat/index";
import { configureEmitter, Rooms } from "./emitter";
import { registerChatHandlers } from "./chat-handler";

/**
 * Servidor Socket.io (v4) montado sobre el mismo servidor HTTP de la API, en la ruta
 * /socket.io. El cliente se autentica con el mismo JWT del REST en `auth.token`; se
 * valida igual que en `authenticate` (firma, versión de token y usuario activo).
 */
export const attachSockets = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigins },
    pingInterval: 20_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 16 * 1024,
  });

  io.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
    if (typeof token !== "string" || token === "") return next(new Error("611"));
    void (async () => {
      const payload = verifyAccessToken(token);
      const user = await findUserById(Number(payload.sub));
      if (user === undefined || user.tokenVersion !== payload.tv) throw new Error("611");
      if (!user.active) throw new Error("612");
      socket.data.person = await findPerson(user.id);
      socket.data.role = user.role;
    })().then(() => next(), (err: unknown) => next(new Error(err instanceof Error && err.message === "612" ? "612" : "611")));
  });

  io.on("connection", (socket) => {
    const person = socket.data.person as { id: number; role: Parameters<typeof Rooms.role>[0] };
    void socket.join([Rooms.GENERAL, Rooms.user(person.id), Rooms.role(person.role)]);
    registerChatHandlers(io, socket);
  });

  configureEmitter(io);
  return io;
};
