import { db } from "../../data-sources/index";
import type { PersonSummary, SearchResponse } from "../../models/index";
import { Roles, type Role } from "../../security/roles";

const LIMIT = 5;
const EMPTY: SearchResponse = { products: [], customers: [], suppliers: [], sales: [], people: [] };

/** Escapa los comodines de LIKE para que el texto se busque literal. */
export const likePattern = (text: string): string => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * Búsqueda global (Ctrl + K): productos, clientes, proveedores, ventas y personas,
 * limitada a lo que el rol puede abrir. Consultas parametrizadas con ILIKE.
 */
export const globalSearch = async (role: Role, text: string): Promise<SearchResponse> => {
  const q = text.trim();
  if (q.length < 2) return EMPTY;
  const like = likePattern(q.slice(0, 80));
  const canSell = role === Roles.ADMIN || role === Roles.SALES;
  const canStock = role === Roles.ADMIN || role === Roles.WAREHOUSE;

  const [products, customers, suppliers, sales, people] = await Promise.all([
    db.query<SearchResponse["products"][number]>(
      `SELECT id, name, sku, stock FROM products WHERE active AND (name ILIKE $1 OR sku ILIKE $1) ORDER BY name LIMIT ${LIMIT}`, [like]),
    canSell
      ? db.query<SearchResponse["customers"][number]>(
          `SELECT id, name, document_id AS document, balance FROM customers WHERE name ILIKE $1 OR document_id ILIKE $1 ORDER BY name LIMIT ${LIMIT}`, [like])
      : Promise.resolve({ rows: [] }),
    canStock
      ? db.query<SearchResponse["suppliers"][number]>(`SELECT id, name FROM suppliers WHERE name ILIKE $1 ORDER BY name LIMIT ${LIMIT}`, [like])
      : Promise.resolve({ rows: [] }),
    canSell
      ? db.query<{ id: number; invoiceNumber: string; customerName: string | null; total: number; createdAt: Date }>(
          `SELECT s.id, s.invoice_number AS "invoiceNumber", c.name AS "customerName", s.total, s.created_at AS "createdAt"
           FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
           WHERE s.invoice_number ILIKE $1 OR c.name ILIKE $1 ORDER BY s.created_at DESC LIMIT ${LIMIT}`, [like])
      : Promise.resolve({ rows: [] }),
    db.query<PersonSummary>(
      `SELECT u.id, (u.first_name || ' ' || u.last_name) AS name, u.username, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.active AND (u.first_name ILIKE $1 OR u.last_name ILIKE $1 OR u.username ILIKE $1) ORDER BY u.first_name LIMIT ${LIMIT}`, [like]),
  ]);
  return {
    products: products.rows,
    customers: customers.rows,
    suppliers: suppliers.rows,
    sales: sales.rows.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
    people: people.rows,
  };
};
