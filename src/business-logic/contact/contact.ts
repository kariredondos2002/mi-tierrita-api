import { db } from "../../data-sources/index";
import type { ContactRequest, ContactResponse } from "../../models/index";
import { onContactReceived } from "../notifications/index";

type ContactRow = Omit<ContactResponse, "createdAt" | "phone"> & { phone: string | null; createdAt: Date };

const toResponse = (r: ContactRow): ContactResponse => ({ ...r, phone: r.phone ?? undefined, createdAt: r.createdAt.toISOString() });

const COLUMNS = `id, name, email, phone, message, handled, created_at AS "createdAt"`;

/** Formulario de contacto de la página pública: se guarda y se avisa a los administradores. */
export const createContactMessage = async (input: ContactRequest): Promise<ContactResponse> => {
  const { rows } = await db.query<ContactRow>(
    `INSERT INTO contact_messages (name, email, phone, message) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
    [input.name, input.email, input.phone ?? null, input.message],
  );
  onContactReceived(input.name);
  return toResponse(rows[0] as ContactRow);
};

export const listContactMessages = async (limit = 50): Promise<ContactResponse[]> => {
  const { rows } = await db.query<ContactRow>(`SELECT ${COLUMNS} FROM contact_messages ORDER BY created_at DESC LIMIT $1`, [limit]);
  return rows.map(toResponse);
};

export const markContactHandled = async (id: number): Promise<boolean> => {
  const { rowCount } = await db.query(`UPDATE contact_messages SET handled = TRUE WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
};
