import "./setup-env";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "socket.io";
import { io as connect } from "socket.io-client";
import { isDomainError } from "../src/common/errors";
import {
  parseContact,
  parseHistoryQuery,
  parseMessageContent,
  parsePrivateMessage,
  parseUpdateProfile,
  toMessageResponse,
} from "../src/models/realtime";
import { addSocket, clearPresence, isOnline, listOnline, removeSocket } from "../src/sockets/presence";
import { configureEmitter, emitToAll, emitToUsers, Rooms } from "../src/sockets/emitter";
import { likePattern } from "../src/business-logic/search/search";

const is400 = (err: unknown) => isDomainError(err) && err.code === "400";

test("parseMessageContent recorta y exige entre 1 y 2000 caracteres", () => {
  assert.equal(parseMessageContent({ content: "  hola  " }), "hola");
  assert.throws(() => parseMessageContent({ content: "   " }), is400);
  assert.throws(() => parseMessageContent({ content: "x".repeat(2001) }), is400);
});

test("parsePrivateMessage exige destinatario entero y contenido", () => {
  assert.deepEqual(parsePrivateMessage({ recipientId: 3, content: "hola" }), { recipientId: 3, content: "hola" });
  assert.throws(() => parsePrivateMessage({ recipientId: "3", content: "hola" }), is400);
});

test("parseHistoryQuery acota el límite y descarta cursores inválidos", () => {
  assert.equal(parseHistoryQuery({}).limit, 40);
  assert.equal(parseHistoryQuery({ limit: "500" }).limit, 100);
  assert.equal(parseHistoryQuery({ before: "no-es-fecha" }).before, undefined);
  assert.ok(parseHistoryQuery({ before: "2026-10-01T10:00:00Z" }).before instanceof Date);
});

test("toMessageResponse expone el emisor sin datos sensibles", () => {
  const r = toMessageResponse({
    id: 1, senderId: 2, senderName: "Ana Gil", senderUsername: "ana", senderRole: "SALES",
    recipientId: null, content: "hola", readAt: null, createdAt: new Date("2026-10-01T10:00:00Z"),
  });
  assert.deepEqual(r.sender, { id: 2, name: "Ana Gil", username: "ana", role: "SALES" });
  assert.equal(r.createdAt, "2026-10-01T10:00:00.000Z");
});

test("parseContact valida correo y mensaje mínimo; el teléfono es opcional", () => {
  assert.deepEqual(parseContact({ name: "Rosa", email: "rosa@x.co", message: "Necesito una cotización" }), {
    name: "Rosa", email: "rosa@x.co", phone: undefined, message: "Necesito una cotización",
  });
  assert.throws(() => parseContact({ name: "Rosa", email: "rosa", message: "corto" }), is400);
});

test("parseUpdateProfile exige nombre y apellido", () => {
  assert.deepEqual(parseUpdateProfile({ firstName: " Karina ", lastName: "Redondo" }), { firstName: "Karina", lastName: "Redondo", email: null, phone: null });
  assert.throws(() => parseUpdateProfile({ firstName: "" }), is400);
});

test("parseUpdateProfile valida correo y teléfono; vacío los borra", () => {
  const ok = parseUpdateProfile({ firstName: "Ana", lastName: "Paz", email: " Ana@MiTierrita.CO ", phone: "+57 300 000-0001" });
  assert.equal(ok.email, "ana@mitierrita.co");
  assert.equal(ok.phone, "+57 300 000-0001");
  assert.deepEqual(parseUpdateProfile({ firstName: "Ana", lastName: "Paz", email: "", phone: "  " }), { firstName: "Ana", lastName: "Paz", email: null, phone: null });
  assert.throws(() => parseUpdateProfile({ firstName: "Ana", lastName: "Paz", email: "ana@" }), is400);
  assert.throws(() => parseUpdateProfile({ firstName: "Ana", lastName: "Paz", phone: "llámame" }), is400);
});

test("likePattern escapa los comodines de LIKE", () => {
  assert.equal(likePattern("50%_a\\b"), "%50\\%\\_a\\\\b%");
});

test("presencia: un usuario con varias pestañas sigue en línea hasta cerrar la última", () => {
  clearPresence();
  const ana = { id: 7, name: "Ana", username: "ana", role: "SALES" as const };
  assert.equal(addSocket(ana, "s1"), true);
  assert.equal(addSocket(ana, "s2"), false);
  assert.equal(removeSocket(7, "s1"), false);
  assert.equal(isOnline(7), true);
  assert.equal(removeSocket(7, "s2"), true);
  assert.equal(isOnline(7), false);
  assert.deepEqual(listOnline(), []);
});

test("el emisor ignora las emisiones si no hay servidor de sockets", () => {
  configureEmitter(undefined);
  assert.doesNotThrow(() => emitToAll("datos:cambio", {}));
  assert.doesNotThrow(() => emitToUsers([1], "notificacion", {}));
});

test("el emisor entrega a la sala de cada usuario y al canal general", async () => {
  const http = createServer();
  const io = new Server(http);
  io.on("connection", (s) => void s.join([Rooms.GENERAL, Rooms.user(Number(s.handshake.auth["id"]))]));
  await new Promise<void>((r) => http.listen(0, r));
  const url = `http://localhost:${(http.address() as AddressInfo).port}`;
  configureEmitter(io);
  const a = connect(url, { auth: { id: 1 }, transports: ["websocket"] });
  const b = connect(url, { auth: { id: 2 }, transports: ["websocket"] });
  await Promise.all([a, b].map((c) => new Promise((r) => c.on("connect", () => r(null)))));
  await new Promise((r) => setTimeout(r, 50));
  const got: string[] = [];
  a.on("notificacion", () => got.push("a:notificacion"));
  b.on("notificacion", () => got.push("b:notificacion"));
  b.on("datos:cambio", () => got.push("b:datos"));
  emitToUsers([1], "notificacion", { id: 1 });
  emitToAll("datos:cambio", { resource: "sales" });
  await new Promise((r) => setTimeout(r, 150));
  assert.deepEqual(got.sort(), ["a:notificacion", "b:datos"]);
  a.close();
  b.close();
  configureEmitter(undefined);
  await io.close();
});
