import type { Server } from "socket.io";
import type { Role } from "../security/roles";

/**
 * Emisor desacoplado (patrón de SoftUnity): la lógica de negocio publica eventos en
 * tiempo real sin conocer Express ni Socket.io. Si el servidor de sockets no está
 * configurado (pruebas, scripts), las emisiones se ignoran en silencio.
 *
 * Salas:
 *   canal:general     todos los usuarios conectados
 *   usuario:<id>      todas las pestañas abiertas de un usuario
 *   rol:<ROL>         todos los usuarios de un rol (avisos de negocio)
 */
export const Rooms = {
  GENERAL: "canal:general",
  user: (id: number) => `usuario:${id}`,
  role: (role: Role) => `rol:${role}`,
} as const;

let io: Server | undefined;

export const configureEmitter = (server: Server | undefined): void => {
  io = server;
};

export const emitToAll = (event: string, payload: unknown): void => {
  io?.to(Rooms.GENERAL).emit(event, payload);
};

export const emitToUsers = (ids: number[], event: string, payload: unknown): void => {
  if (io === undefined || ids.length === 0) return;
  io.to([...new Set(ids)].map(Rooms.user)).emit(event, payload);
};

export const emitToRoles = (roles: Role[], event: string, payload: unknown): void => {
  if (io === undefined || roles.length === 0) return;
  io.to(roles.map(Rooms.role)).emit(event, payload);
};
