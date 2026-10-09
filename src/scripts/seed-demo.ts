/**
 * Datos de demostración de Mi Tierrita SIG (simulados, no son datos reales del negocio).
 *   pnpm db:seed            → solo siembra si la base no tiene productos
 *   pnpm db:seed -- --force → siembra aunque ya existan productos (puede duplicar movimientos)
 *
 * Usa la misma lógica de negocio que la API (lotes, FEFO, crédito, abonos, escenarios), así que
 * stock, cartera e indicadores quedan consistentes. Después ajusta las fechas para simular
 * 120 días de operación y deja huellas en la auditoría.
 */
import { db } from "../data-sources/db";
import { hashPassword } from "../security/password";
import { createCategory } from "../business-logic/categories/create-category";
import { createSupplier } from "../business-logic/suppliers/create-supplier";
import { createProduct } from "../business-logic/products/create-product";
import { registerBatch } from "../business-logic/batches/register-batch";
import { createCustomer } from "../business-logic/customers/create-customer";
import { registerSale } from "../business-logic/sales/register-sale";
import { registerPayment } from "../business-logic/customers/register-payment";
import { voidSale } from "../business-logic/sales/void-sale";
import { createScenario } from "../business-logic/financial/create-scenario";
import { PRESET_SCENARIOS } from "../business-logic/financial/engine";
import { PaymentTypes } from "../models/index";

const DAYS = 120;
const DEMO_PASSWORD = "MiTierrita2026";

// PRNG determinista: la demo sale igual en cada computador
let seed = 20262;
const rand = (): number => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const pick = <T>(items: T[]): T => items[Math.floor(rand() * items.length)] as T;
const between = (min: number, max: number): number => Math.floor(min + rand() * (max - min + 1));

const isoDate = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const CATEGORIES = [
  "Alimentos balanceados",
  "Aves de corral",
  "Medicina veterinaria",
  "Agroquímicos",
  "Semillas y fertilizantes",
  "Ferretería agrícola",
];

const SUPPLIERS = [
  { name: "Distribuidora de Concentrados del Sinú", taxId: "900123456-1", phone: "604 782 1100" },
  { name: "Incubadora Avícola de Córdoba", taxId: "900234567-2", phone: "604 785 2210" },
  { name: "VetAgro Montería", taxId: "900345678-3", phone: "604 789 3320" },
  { name: "Agroinsumos La Sabana", taxId: "900456789-4", phone: "604 777 4430" },
  { name: "Ferretería y Herramientas El Campo", taxId: "900567890-5", phone: "604 776 5540" },
];

// [nombre, sku, categoría, costo, precio, vida útil en días, proveedor, peso en ventas]
type ProductSeed = [string, string, number, number, number, number, number, number];
const PRODUCTS: ProductSeed[] = [
  ["Concentrado pollo engorde iniciación 40 kg", "ALB-001", 0, 92_000, 108_000, 120, 0, 10],
  ["Concentrado pollo engorde finalización 40 kg", "ALB-002", 0, 88_000, 104_000, 120, 0, 9],
  ["Concentrado gallina ponedora 40 kg", "ALB-003", 0, 84_000, 99_000, 120, 0, 7],
  ["Concentrado cerdo levante 40 kg", "ALB-004", 0, 90_000, 106_000, 120, 0, 6],
  ["Concentrado ganado lechero 40 kg", "ALB-005", 0, 72_000, 86_000, 150, 0, 6],
  ["Alimento para perro adulto 15 kg", "ALB-006", 0, 98_000, 125_000, 300, 0, 4],
  ["Sal mineralizada 40 kg", "ALB-007", 0, 58_000, 72_000, 365, 0, 5],
  ["Pollito de engorde (unidad)", "AVE-001", 1, 2_600, 3_500, 4, 1, 8],
  ["Pollita ponedora 8 semanas (unidad)", "AVE-002", 1, 16_000, 21_000, 10, 1, 3],
  ["Pato criollo (unidad)", "AVE-003", 1, 9_000, 13_000, 10, 1, 1],
  ["Vacuna Newcastle 1000 dosis", "VET-001", 2, 38_000, 52_000, 240, 2, 3],
  ["Ivermectina 1 % 500 ml", "VET-002", 2, 46_000, 62_000, 540, 2, 3],
  ["Oxitetraciclina 100 ml", "VET-003", 2, 18_000, 26_000, 360, 2, 2],
  ["Vitaminas AD3E 100 ml", "VET-004", 2, 15_000, 22_000, 360, 2, 2],
  ["Desparasitante bovino 1 L", "VET-005", 2, 64_000, 85_000, 540, 2, 2],
  ["Glifosato 1 L", "AGR-001", 3, 21_000, 29_000, 720, 3, 4],
  ["Herbicida 2,4-D 1 L", "AGR-002", 3, 24_000, 33_000, 720, 3, 3],
  ["Insecticida cipermetrina 250 ml", "AGR-003", 3, 14_000, 20_000, 720, 3, 2],
  ["Urea 50 kg", "SEM-001", 4, 132_000, 155_000, 720, 3, 3],
  ["Semilla de maíz híbrido 20 kg", "SEM-002", 4, 340_000, 395_000, 270, 3, 1],
  ["Pasto brachiaria 10 kg", "SEM-003", 4, 210_000, 255_000, 365, 3, 1],
  ["Alambre de púas 400 m", "FER-001", 5, 165_000, 198_000, 3650, 4, 2],
  ["Machete 22 pulgadas", "FER-002", 5, 19_000, 28_000, 3650, 4, 2],
  ["Bebedero automático para aves 8 L", "FER-003", 5, 21_000, 32_000, 3650, 4, 2],
  ["Comedero tolva para aves 10 kg", "FER-004", 5, 24_000, 36_000, 3650, 4, 1],
];

const CUSTOMERS = [
  { name: "Granja Avícola El Porvenir", documentId: "901112233", phone: "310 555 0101", creditLimit: 6_000_000 },
  { name: "Finca La Esperanza", documentId: "1067845123", phone: "311 555 0102", creditLimit: 3_000_000 },
  { name: "Hacienda San Isidro", documentId: "900998877", phone: "312 555 0103", creditLimit: 8_000_000 },
  { name: "Asociación de Avicultores de Sahagún", documentId: "901223344", phone: "313 555 0104", creditLimit: 10_000_000 },
  { name: "Porcícola Los Almendros", documentId: "901334455", phone: "314 555 0105", creditLimit: 5_000_000 },
  { name: "Finca El Recreo", documentId: "1067934567", phone: "315 555 0106", creditLimit: 2_000_000 },
  { name: "Parcela Villa Luz", documentId: "1068011223", phone: "316 555 0107", creditLimit: 1_500_000 },
  { name: "Ganadería La Ceiba", documentId: "900445566", phone: "317 555 0108", creditLimit: 7_000_000 },
  { name: "Huevos Frescos del Sinú", documentId: "901556677", phone: "318 555 0109", creditLimit: 4_000_000 },
  { name: "Finca Las Palmas", documentId: "1067123987", phone: "319 555 0110", creditLimit: 2_500_000 },
  { name: "Cliente de mostrador frecuente", documentId: "1003456789", phone: "320 555 0111", creditLimit: 800_000 },
  { name: "Tienda Veterinaria Rural El Llano", documentId: "901667788", phone: "321 555 0112", creditLimit: 3_500_000 },
];

const USERS = [
  { firstName: "Administración", lastName: "Mi Tierrita", username: "admin", role: "ADMIN", email: "admin@mitierrita.co", phone: "300 000 0001" },
  { firstName: "Secretaria", lastName: "Ventas", username: "secretaria", role: "SALES", email: "ventas@mitierrita.co", phone: "300 000 0002" },
  { firstName: "Auxiliar", lastName: "Bodega", username: "bodega", role: "WAREHOUSE", email: "bodega@mitierrita.co", phone: "300 000 0003" },
];

const ensureUser = async (u: (typeof USERS)[number]): Promise<number> => {
  const { rows } = await db.query<{ id: number }>(`SELECT id FROM users WHERE lower(username) = lower($1)`, [u.username]);
  if (rows[0]) {
    // v4.2: completa correo y teléfono de los usuarios de demostración sin pisar lo que ya editaron
    await db.query(`UPDATE users SET email = COALESCE(email, $2), phone = COALESCE(phone, $3) WHERE id = $1`, [rows[0].id, u.email, u.phone]);
    return rows[0].id;
  }
  const created = await db.query<{ id: number }>(
    `INSERT INTO users (first_name, last_name, username, password_hash, role_id, email, phone, created_at)
     VALUES ($1, $2, $3, $4, (SELECT id FROM roles WHERE name = $5), $6, $7, now() - interval '${DAYS + 10} days') RETURNING id`,
    [u.firstName, u.lastName, u.username, await hashPassword(DEMO_PASSWORD), u.role, u.email, u.phone],
  );
  return created.rows[0]!.id;
};


/**
 * Conversaciones, avisos y contactos de ejemplo (v4) para que el chat y la campana no
 * aparezcan vacíos en la demostración. Solo se siembran si la tabla de mensajes está vacía,
 * así que también corre sobre una base que ya tenía el catálogo.
 */
const seedTeamChat = async () => {
  const { rows } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM messages`);
  if ((rows[0]?.n ?? 0) > 0) return;
  const ids = await Promise.all(USERS.map((u) => ensureUser(u)));
  const [admin, sales, store] = ids as [number, number, number];
  console.log("Chat del equipo y notificaciones…");
  await db.query(`UPDATE users SET last_seen_at = now() - interval '35 minutes' WHERE id = $1 AND last_seen_at IS NULL`, [store]);
  await db.query(`UPDATE users SET last_seen_at = now() - interval '2 hours' WHERE id = $1 AND last_seen_at IS NULL`, [sales]);
  const say = (from: number, to: number | null, content: string, minutesAgo: number, read = true) =>
    db.query(
      `INSERT INTO messages (sender_id, recipient_id, content, created_at, read_at)
       VALUES ($1, $2::bigint, $3, now() - ($4::text || ' minutes')::interval,
               CASE WHEN $5::boolean AND $2::bigint IS NOT NULL THEN now() - ($4::text || ' minutes')::interval + interval '3 minutes' END)`,
      [from, to, content, minutesAgo, read],
    );
  await say(admin, null, "Buenos días. Hoy llega el camión de concentrados; bodega, por favor dejen espacio en la estiba 3.", 300);
  await say(store, null, "Listo, ya despejamos la estiba 3. Los bultos de sal mineralizada pasan al fondo.", 290);
  await say(sales, null, "En caja hay tres clientes preguntando por la vacuna de aftosa. ¿Cuándo entra?", 180);
  await say(admin, null, "Debe entrar el jueves. Anoten nombre y teléfono y les avisamos.", 175);
  await say(store, null, "Atención: el lote de pollitas ponedoras está casi agotado; quedan pocas unidades.", 60);
  await say(admin, sales, "¿Cómo va la cartera de Finca Las Palmas? Ya pasaron 30 días.", 140);
  await say(sales, admin, "Hoy abonaron una parte. Les recordé el saldo y quedaron de pagar el resto la otra semana.", 132);
  await say(admin, sales, "Perfecto, gracias. Déjalo anotado en el cliente.", 130);
  await say(store, admin, "Llegaron 40 bultos de concentrado de engorde; ya quedaron registrados con su vencimiento.", 45, false);
  await say(store, admin, "Ojo: dos sacos venían rotos, los separé para devolución.", 44, false);
  await say(sales, store, "¿Me confirmas si queda semilla de maíz híbrido? Un cliente quiere 5 bultos.", 25, false);

  const notify = (user: number, kind: string, message: string, link: string, minutesAgo: number, read = false) =>
    db.query(`INSERT INTO notifications (user_id, kind, message, link, read, created_at) VALUES ($1, $2, $3, $4, $5, now() - ($6::text || ' minutes')::interval)`,
      [user, kind, message, link, read, minutesAgo]);
  await notify(admin, "LOW_STOCK", "Pollita ponedora 8 semanas (unidad) quedó con 2 unidades", "/inventario", 58);
  await notify(admin, "PURCHASE", "Entraron 40 u. de Concentrado de engorde 40 kg", "/lotes", 46);
  await notify(admin, "PAYMENT", "Abono de $350.000 de Finca Las Palmas", "/clientes", 133, true);
  await notify(admin, "CONTACT", "Nuevo mensaje de contacto de Rosa Díaz", "/contactos", 20);
  await notify(store, "LOW_STOCK", "Pollita ponedora 8 semanas (unidad) quedó con 2 unidades", "/inventario", 58);
  await notify(sales, "SALE_VOIDED", "Se anuló la venta FV-2026-000412 por $46.000", "/ventas", 400, true);

  await db.query(
    `INSERT INTO contact_messages (name, email, phone, message, created_at) VALUES
     ('Rosa Díaz', 'rosa.diaz@example.com', '300 555 0101', 'Buenas tardes, ¿tienen concentrado para cerdos al por mayor y hacen domicilio a la vereda Los Arrayanes?', now() - interval '20 minutes'),
     ('Asociación de Ganaderos de Sahagún', 'contacto@example.org', NULL, 'Queremos cotizar sal mineralizada y vacunas para 60 animales para el ciclo de noviembre.', now() - interval '2 days')`,
  );
};

const main = async () => {
  const force = process.argv.includes("--force");
  // En producción la demo solo se siembra si se pide de forma explícita (SEED_DEMO=true)
  if (process.env["NODE_ENV"] === "production" && process.env["SEED_DEMO"] !== "true") {
    console.log("Datos de demostración omitidos (defina SEED_DEMO=true para sembrarlos).");
    return;
  }
  await seedTeamChat();
  // v4.2: correo y teléfono de los usuarios de demostración, también en bases ya sembradas (no pisa lo editado)
  for (const u of USERS) await db.query(`UPDATE users SET email = COALESCE(email, $2), phone = COALESCE(phone, $3) WHERE lower(username) = lower($1)`, [u.username, u.email, u.phone]);
  const { rows: existing } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM products`);
  if ((existing[0]?.n ?? 0) > 0 && !force) {
    console.log("La base ya tiene productos; no se siembra nada (usa --force para sembrar de todos modos).");
    return;
  }

  const [adminId, salesId, warehouseId] = [await ensureUser(USERS[0]!), await ensureUser(USERS[1]!), await ensureUser(USERS[2]!)];
  const audit = async (userId: number, method: string, resource: string, daysAgo: number) =>
    db.query(`INSERT INTO audits (user_id, method, resource, created_at) VALUES ($1, $2, $3, now() - ($4 || ' days')::interval - (random() * interval '8 hours'))`, [userId, method, resource, daysAgo]);

  console.log("Catálogo…");
  const categoryIds: number[] = [];
  for (const name of CATEGORIES) categoryIds.push((await createCategory({ name })).id);
  const supplierIds: number[] = [];
  for (const s of SUPPLIERS) supplierIds.push((await createSupplier(s)).id);

  const products: { id: number; seed: ProductSeed }[] = [];
  for (const p of PRODUCTS) {
    const created = await createProduct({ name: p[0], sku: p[1], categoryId: categoryIds[p[2]]!, purchasePrice: p[3], salePrice: p[4] });
    products.push({ id: created.id, seed: p });
    await audit(adminId, "POST", "/api/v1/products", DAYS + 5);
  }

  console.log("Lotes con vencimientos…");
  // Un lote antiguo grande (abastece la historia) + uno reciente. Algunos quedan por vencer o vencidos.
  for (const { id, seed: p } of products) {
    const shelf = p[5];
    const weight = p[7];
    const unitsPerSale = p[4] < 10_000 ? 35 : p[4] > 150_000 ? 1 : 2;
    // Demanda esperada: ~0,16 líneas diarias por punto de peso; se deja un 25 % de holgura
    const historyUnits = Math.ceil(0.16 * weight * unitsPerSale * DAYS * 1.25);
    const oldBatch = await registerBatch({
      productId: id,
      quantity: historyUnits,
      expiresAt: isoDate(Math.max(shelf - DAYS, 2) + between(5, 40)),
      supplierId: supplierIds[p[6]],
      unitCost: p[3],
    });
    await db.query(`UPDATE product_batches SET created_at = now() - interval '${DAYS + 2} days' WHERE id = $1`, [oldBatch.id]);
    await audit(warehouseId, "POST", `/api/v1/products/${id}/batches`, DAYS + 2);
  }

  console.log("Clientes…");
  const customerIds: number[] = [];
  for (const c of CUSTOMERS) {
    customerIds.push((await createCustomer(c)).id);
    await audit(salesId, "POST", "/api/v1/customers", DAYS + 1);
  }
  await db.query(`UPDATE customers SET created_at = now() - interval '${DAYS + 1} days'`);

  console.log(`Ventas de ${DAYS} días…`);
  const overdue = new Set([customerIds[1]!, customerIds[6]!]);
  const weighted = products.flatMap((p) => Array.from({ length: p.seed[7] }, () => p));
  let saleCount = 0;
  for (let day = DAYS; day >= 0; day--) {
    const weekday = new Date(Date.now() - day * 86_400_000).getDay();
    if (weekday === 0 && rand() < 0.7) continue; // domingo casi siempre cerrado
    const trend = 1 + (DAYS - day) / DAYS * 0.12; // las ventas crecen poco a poco
    const salesToday = Math.round(between(4, 8) * trend);
    for (let s = 0; s < salesToday; s++) {
      const lines = new Map<number, number>();
      const nLines = between(1, 4);
      for (let l = 0; l < nLines; l++) {
        const p = pick(weighted);
        const qty = p.seed[4] < 10_000 ? between(10, 60) : p.seed[4] > 150_000 ? 1 : between(1, 3);
        lines.set(p.id, (lines.get(p.id) ?? 0) + qty);
      }
      let credit = rand() < 0.28;
      let customerId = credit || rand() < 0.4 ? pick(customerIds) : undefined;
      // Dos clientes dejan de comprar y de abonar hace más de 45 días: cartera vencida
      if (customerId !== undefined && overdue.has(customerId) && day < 45) {
        customerId = undefined;
        credit = false;
      }
      try {
        const sale = await registerSale(rand() < 0.75 ? salesId : adminId, {
          paymentType: credit && customerId ? PaymentTypes.CREDIT : PaymentTypes.CASH,
          customerId,
          lines: [...lines].map(([productId, quantity]) => ({ productId, quantity })),
        });
        const minutes = between(7 * 60, 18 * 60);
        await db.query(
          `UPDATE sales SET created_at = date_trunc('day', now()) - ($2 || ' days')::interval + ($3 || ' minutes')::interval WHERE id = $1`,
          [sale.id, day, minutes],
        );
        await audit(sale.userId, "POST", "/api/v1/sales", day);
        saleCount++;
        if (rand() < 0.012 && day > 3) {
          await voidSale(sale.id, adminId);
          await db.query(`UPDATE sales SET voided_at = created_at + interval '2 hours' WHERE id = $1`, [sale.id]);
          await audit(adminId, "POST", `/api/v1/sales/${sale.id}/void`, day);
        }
      } catch {
        // Sin stock o sin cupo: en la vida real la venta simplemente no se hace
      }
    }
    // Abonos de cartera cada pocos días
    if (day % 4 === 0) {
      for (const customerId of customerIds) {
        if (overdue.has(customerId) && day < 60) continue;
        const { rows } = await db.query<{ balance: number }>(`SELECT balance FROM customers WHERE id = $1`, [customerId]);
        const balance = Number(rows[0]?.balance ?? 0);
        if (balance > 50_000 && rand() < 0.55) {
          const amount = Math.round((balance * (0.3 + rand() * 0.5)) / 1000) * 1000;
          const payment = await registerPayment(customerId, salesId, { amount });
          await db.query(`UPDATE customer_payments SET created_at = now() - ($2 || ' days')::interval WHERE id = $1`, [payment.id, day]);
          await audit(salesId, "POST", `/api/v1/customers/${customerId}/payments`, day);
        }
      }
    }
  }
  console.log(`  ${saleCount} ventas registradas`);

  console.log("Reabastecimiento reciente…");
  for (const { id, seed: p } of products) {
    const shelf = p[5];
    const weight = p[7];
    const unitsPerSale = p[4] < 10_000 ? 35 : p[4] > 150_000 ? 1 : 2;
    // Algunos productos quedan con poco stock a propósito (alertas de reposición)
    if (rand() < 0.2) continue;
    const near = rand() < 0.18; // lote próximo a vencer
    const batch = await registerBatch({
      productId: id,
      quantity: Math.ceil(0.16 * weight * unitsPerSale * between(15, 35)) + 2,
      expiresAt: isoDate(near ? between(3, 25) : Math.min(shelf, 900)),
      supplierId: supplierIds[p[6]],
      unitCost: Math.round(p[3] * (1 + rand() * 0.04)),
    });
    await db.query(`UPDATE product_batches SET created_at = now() - interval '${between(1, 10)} days' WHERE id = $1`, [batch.id]);
    await audit(warehouseId, "POST", `/api/v1/suppliers/${supplierIds[p[6]]}/purchases`, between(1, 10));
  }
  // Dos lotes ya vencidos para que el tablero muestre la baja pendiente
  for (const { id, seed: p } of products.filter((x) => x.seed[2] === 2).slice(0, 2)) {
    const batch = await registerBatch({ productId: id, quantity: between(3, 8), expiresAt: isoDate(-between(2, 12)), supplierId: supplierIds[p[6]], unitCost: p[3] });
    await db.query(`UPDATE product_batches SET created_at = now() - interval '200 days' WHERE id = $1`, [batch.id]);
  }

  // Tres productos quedan con existencias bajas (alertas de reposición): se simula el ajuste por
  // conteo físico dejando 2 a 4 unidades, descontadas de sus lotes para mantener stock = suma de lotes.
  const lowStock = products.filter((x) => [1, 5, 4].includes(x.seed[2])).slice(0, 3);
  for (const { id } of lowStock) {
    const keep = between(2, 4);
    await db.transaction(async (client) => {
      const { rows } = await client.query<{ id: number; quantity_remaining: number }>(
        `SELECT id, quantity_remaining FROM product_batches WHERE product_id = $1 AND quantity_remaining > 0 ORDER BY expires_at DESC FOR UPDATE`,
        [id],
      );
      let left = keep;
      for (const batch of rows) {
        const remain = Math.min(left, batch.quantity_remaining);
        left -= remain;
        await client.query(`UPDATE product_batches SET quantity_remaining = $2 WHERE id = $1`, [batch.id, remain]);
      }
      await client.query(`UPDATE products SET stock = $2, updated_at = now() WHERE id = $1`, [id, keep - left]);
    });
  }

  console.log("Escenarios financieros de la ampliación…");
  for (const [i, preset] of PRESET_SCENARIOS.entries()) {
    const s = await createScenario(adminId, { name: preset.name, input: preset.input });
    const ago = `${24 - i * 2} days`;
    await db.query(`UPDATE financial_scenarios SET created_at = now() - $2::interval, updated_at = now() - $2::interval WHERE id = $1`, [s.id, ago]);
    await audit(adminId, "POST", "/api/v1/financial/scenarios", 20);
  }

  console.log(`Listo. Usuarios: admin, secretaria y bodega · contraseña ${DEMO_PASSWORD}`);
};

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void db.close());
