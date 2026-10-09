import { createValidator } from "../common/validate";
import type { Role } from "../security/roles";

/**
 * Tiempo real (v4): chat del equipo, notificaciones, directorio de personas, búsqueda
 * global, perfil propio y contacto de la página pública.
 */

export const MESSAGE_MAX_LENGTH = 2000;

/** Persona tal como la ven el chat, la presencia y la búsqueda (sin datos sensibles). */
export type PersonSummary = { id: number; name: string; username: string; role: Role };

export type DirectoryEntry = PersonSummary & { lastSeenAt: string | null; online: boolean };

export type MessageRow = {
  id: number;
  senderId: number;
  senderName: string;
  senderUsername: string;
  senderRole: Role;
  recipientId: number | null;
  content: string;
  readAt: Date | null;
  createdAt: Date;
};

export type MessageResponse = {
  id: number;
  sender: PersonSummary;
  recipientId: number | null;
  content: string;
  readAt: string | null;
  createdAt: string;
};

export const toMessageResponse = (row: MessageRow): MessageResponse => ({
  id: row.id,
  sender: { id: row.senderId, name: row.senderName, username: row.senderUsername, role: row.senderRole },
  recipientId: row.recipientId,
  content: row.content,
  readAt: row.readAt === null ? null : row.readAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
});

export type MessagePage = { messages: MessageResponse[]; hasMore: boolean };

export type ConversationResponse = {
  person: PersonSummary;
  lastMessage: { id: number; content: string; senderId: number; createdAt: string };
  unread: number;
};

/** Contenido de un mensaje: texto recortado de 1 a 2000 caracteres. */
export const parseMessageContent = (body: unknown): string => {
  const v = createValidator(body);
  const content = v.string("content", { min: 1, max: MESSAGE_MAX_LENGTH });
  v.done();
  return content as string;
};

export const parsePrivateMessage = (body: unknown): { recipientId: number; content: string } => {
  const v = createValidator(body);
  const recipientId = v.number("recipientId", { integer: true, min: 1 });
  const content = v.string("content", { min: 1, max: MESSAGE_MAX_LENGTH });
  v.done();
  return { recipientId: recipientId as number, content: content as string };
};

/** Cursor de historial: ?before=<ISO>&limit=<1..100>. */
export type HistoryQuery = { before?: Date | undefined; limit: number };

export const parseHistoryQuery = (query: Record<string, unknown>): HistoryQuery => {
  const rawLimit = Number(query["limit"]);
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 40;
  const rawBefore = typeof query["before"] === "string" ? new Date(query["before"]) : undefined;
  const before = rawBefore !== undefined && !Number.isNaN(rawBefore.getTime()) ? rawBefore : undefined;
  return { before, limit };
};

// --- notificaciones ---

export const NotificationKinds = {
  SALE: "SALE",
  SALE_VOIDED: "SALE_VOIDED",
  PAYMENT: "PAYMENT",
  PURCHASE: "PURCHASE",
  LOW_STOCK: "LOW_STOCK",
  SCENARIO: "SCENARIO",
  CONTACT: "CONTACT",
  MESSAGE: "MESSAGE",
} as const;
export type NotificationKind = (typeof NotificationKinds)[keyof typeof NotificationKinds];

export type NotificationRow = { id: number; kind: NotificationKind; message: string; link: string | null; read: boolean; createdAt: Date };
export type NotificationResponse = Omit<NotificationRow, "createdAt"> & { createdAt: string };

export const toNotificationResponse = (row: NotificationRow): NotificationResponse => ({ ...row, createdAt: row.createdAt.toISOString() });

export type NotificationInput = { kind: NotificationKind; message: string; link?: string | null };

export const parseMarkNotifications = (body: unknown): { ids?: number[] | undefined } => {
  const v = createValidator(body ?? {});
  const ids = v.array("ids", { max: 200 }, () => undefined, false);
  v.done();
  const raw = (body as { ids?: unknown } | undefined)?.ids;
  if (ids === undefined || !Array.isArray(raw)) return {};
  return { ids: raw.filter((n): n is number => Number.isInteger(n) && (n as number) > 0) };
};

// --- perfil propio ---

export type UpdateProfileRequest = { firstName: string; lastName: string; email: string | null; phone: string | null };

const EMAIL_RULE = { max: 160, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMessage: "Correo inválido" };
const PHONE_RULE = { max: 40, pattern: /^[0-9+()\s-]{7,40}$/, patternMessage: "Solo números, espacios, +, ( ) y guiones" };

/** Mi perfil (v4.2, como en SoftUnity): nombre, apellido, correo y teléfono; vacío borra el dato opcional. */
export const parseUpdateProfile = (body: unknown): UpdateProfileRequest => {
  const v = createValidator(body);
  const firstName = v.string("firstName", { min: 1, max: 80 });
  const lastName = v.string("lastName", { min: 1, max: 80 });
  const rawEmail = (body as { email?: unknown } | null)?.email;
  const rawPhone = (body as { phone?: unknown } | null)?.phone;
  const email = typeof rawEmail === "string" && rawEmail.trim() !== "" ? v.string("email", EMAIL_RULE, false) : undefined;
  const phone = typeof rawPhone === "string" && rawPhone.trim() !== "" ? v.string("phone", PHONE_RULE, false) : undefined;
  v.done();
  return { firstName: firstName as string, lastName: lastName as string, email: email ? email.toLowerCase() : null, phone: phone ?? null };
};

/** Mi actividad: últimas acciones propias y conteos de los últimos 30 días. */
export type ActivityItem = { id: number; method: string; resource: string; detail: string | null; createdAt: string };
export type MyActivity = { items: ActivityItem[]; last30Days: { writes: number; exports: number; signins: number; sales: number; payments: number; batches: number }; lastSigninAt: string | null };

// --- búsqueda global ---

export type SearchResponse = {
  products: { id: number; name: string; sku: string; stock: number }[];
  customers: { id: number; name: string; document: string | null; balance: number }[];
  suppliers: { id: number; name: string }[];
  sales: { id: number; invoiceNumber: string; customerName: string | null; total: number; createdAt: string }[];
  people: PersonSummary[];
};

// --- contacto público ---

export type ContactRequest = { name: string; email: string; phone?: string | undefined; message: string };
export type ContactResponse = ContactRequest & { id: number; handled: boolean; createdAt: string };

export const parseContact = (body: unknown): ContactRequest => {
  const v = createValidator(body);
  const name = v.string("name", { min: 2, max: 120 });
  const email = v.string("email", { min: 5, max: 160, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMessage: "Correo inválido" });
  const phone = v.string("phone", { max: 40 }, false);
  const message = v.string("message", { min: 10, max: 2000 });
  v.done();
  return { name: name as string, email: email as string, phone: phone === "" ? undefined : phone, message: message as string };
};
