import "./setup-env";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/data-sources/index";
import { isDomainError } from "../src/common/errors";
import {
  deliverPending, generalHistory, pinMessage, privateHistory, readAttachment, readConversation,
  receiptDetail, saveAttachment, searchMessages, sendMessage, threadOf, unreadSummary,
} from "../src/business-logic/chat/index";
import { parseSendMessage } from "../src/models/index";
import { addSocket, clearPresence } from "../src/sockets/presence";

/** Integración contra PostgreSQL real; se omite si no hay base disponible. */
let up = false;
const ids: Record<string, number> = {};
const TAG = `chatit${Date.now()}`;

before(async () => {
  try {
    await db.ping();
    up = true;
  } catch {
    return;
  }
  for (const [key, role] of [["admin", 1], ["sec", 2], ["bod", 3]] as const) {
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO users (first_name, last_name, username, password_hash, role_id) VALUES ($1,'Prueba',$2,'x',$3) RETURNING id`,
      [key, `${TAG}${key}`, role],
    );
    ids[key] = rows[0]!.id;
  }
});

after(async () => {
  if (up) {
    const list = Object.values(ids);
    await db.query(`DELETE FROM message_attachments WHERE uploader_id = ANY($1::bigint[])`, [list]);
    await db.query(`DELETE FROM messages WHERE sender_id = ANY($1::bigint[])`, [list]);
    await db.query(`DELETE FROM users WHERE id = ANY($1::bigint[])`, [list]);
  }
  clearPresence();
  await db.close();
});

const person = (id: number, name: string) => ({ id, name, username: name, role: "ADMIN" as const });
const cid = () => crypto.randomUUID();
/** Igual que el controlador: el parser completa los campos opcionales. */
const send = (senderId: number, raw: Record<string, unknown>) => {
  const { recipientId, ...rest } = raw;
  return sendMessage(senderId, { ...parseSendMessage(rest), recipientId: (recipientId as number | null | undefined) ?? null });
};

test("recibos: enviado → entregado (en línea) → visto, con detalle por persona", { skip: false }, async (t) => {
  if (!up) return t.skip("sin base de datos");
  addSocket(person(ids["sec"]!, "sec"), "s1");
  const m = await send(ids["admin"]!, { content: "Buen día equipo", recipientId: null, clientId: cid() });
  assert.equal(m.receipts?.total, m.receipts?.total);
  let d = await receiptDetail(m.id, ids["admin"]!);
  const by = (u: number) => d.people.find((p) => p.person.id === u)!.status;
  assert.equal(by(ids["sec"]!), "DELIVERED");
  assert.equal(by(ids["bod"]!), "PENDING");
  await deliverPending(ids["bod"]!);
  await readConversation(ids["sec"]!, "general");
  d = await receiptDetail(m.id, ids["admin"]!);
  assert.equal(by(ids["sec"]!), "READ");
  assert.equal(by(ids["bod"]!), "DELIVERED");
  // solo el autor ve el detalle
  await assert.rejects(() => receiptDetail(m.id, ids["sec"]!), isDomainError);
  // y quienes no son autores no reciben el objeto de recibos
  const h = await generalHistory(ids["sec"]!, { limit: 50 });
  assert.equal(h.messages.find((x) => x.id === m.id)?.receipts, null);
});

test("sin duplicados: el mismo clientId devuelve el mismo mensaje", async (t) => {
  if (!up) return t.skip("sin base de datos");
  const clientId = cid();
  const a = await send(ids["admin"]!, { content: "uno", recipientId: null, clientId });
  const b = await send(ids["admin"]!, { content: "uno", recipientId: null, clientId });
  assert.equal(a.id, b.id);
});

test("privacidad: un privado solo lo ven sus dos participantes y no entra a la búsqueda ajena", async (t) => {
  if (!up) return t.skip("sin base de datos");
  const p = await send(ids["admin"]!, { content: `secreto-${TAG}`, recipientId: ids["sec"]! });
  assert.equal((await privateHistory(ids["sec"]!, ids["admin"]!, { limit: 10 })).messages.some((x) => x.id === p.id), true);
  assert.equal((await searchMessages(ids["bod"]!, `secreto-${TAG}`, null, 20)).length, 0);
  assert.equal((await searchMessages(ids["sec"]!, `secreto-${TAG}`, null, 20)).length, 1);
  await assert.rejects(() => threadOf(p.id, ids["bod"]!), isDomainError);
  await assert.rejects(() => pinMessage(p.id, ids["bod"]!, "WAREHOUSE", true), isDomainError);
});

test("citas, hilos y respuesta privada sin publicar en el grupo", async (t) => {
  if (!up) return t.skip("sin base de datos");
  const root = await send(ids["admin"]!, { content: "¿Llegó el pedido?", recipientId: null });
  const reply = await send(ids["sec"]!, { content: "Sí, llegó", recipientId: null, threadRootId: root.id });
  assert.equal(reply.threadRootId, root.id);
  const th = await threadOf(root.id, ids["bod"]!);
  assert.equal(th.replies.length, 1);
  const general = await generalHistory(ids["bod"]!, { limit: 100 });
  assert.equal(general.messages.some((x) => x.id === reply.id), false, "las respuestas de hilo no ensucian el canal");
  const quoted = await send(ids["bod"]!, { content: "Confirmo", recipientId: null, replyToId: root.id });
  assert.equal(quoted.replyTo?.id, root.id);
  const priv = await send(ids["bod"]!, { content: "te cuento aparte", recipientId: ids["admin"]!, replyToId: root.id });
  assert.equal(priv.recipientId, ids["admin"]);
  assert.equal((await generalHistory(ids["sec"]!, { limit: 100 })).messages.some((x) => x.id === priv.id), false);
});

test("fijar: solo ADMIN en el general; menciones y no leídos", async (t) => {
  if (!up) return t.skip("sin base de datos");
  const m = await send(ids["admin"]!, { content: `Atención @${TAG}bod revisar bodega`, recipientId: null });
  assert.deepEqual(m.mentions, [ids["bod"]]);
  await assert.rejects(() => pinMessage(m.id, ids["sec"]!, "SALES", true), isDomainError);
  const pinned = await pinMessage(m.id, ids["admin"]!, "ADMIN", true);
  assert.ok(pinned.pinnedAt);
  assert.equal((await pinMessage(m.id, ids["admin"]!, "ADMIN", false)).pinnedAt, null);
  const s = await unreadSummary(ids["bod"]!);
  assert.ok(s.mentions >= 1 && s.general >= 1);
  await readConversation(ids["bod"]!, "general");
  assert.equal((await unreadSummary(ids["bod"]!)).general, 0);
});

test("adjuntos y audio: se validan y solo los ve quien participa", async (t) => {
  if (!up) return t.skip("sin base de datos");
  await assert.rejects(() => saveAttachment(ids["admin"]!, "virus.exe", "application/x-msdownload", Buffer.from("MZ"), null), isDomainError);
  const a = await saveAttachment(ids["admin"]!, "nota.webm", "audio/webm", Buffer.from("audio"), 3200);
  const m = await send(ids["admin"]!, { recipientId: ids["sec"]!, attachmentId: a.id });
  assert.equal(m.kind, "AUDIO");
  assert.equal((await readAttachment(a.id, ids["sec"]!)).fileName, "nota.webm");
  await assert.rejects(() => readAttachment(a.id, ids["bod"]!), isDomainError);
  await assert.rejects(() => send(ids["sec"]!, { recipientId: ids["admin"]!, attachmentId: a.id }), isDomainError);
});
