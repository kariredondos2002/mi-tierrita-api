import { db } from "../../data-sources/index";
import { NotificationKinds, type SaleResponse, type ScenarioSummaryResponse } from "../../models/index";
import { Roles } from "../../security/roles";
import { emitToAll } from "../../sockets/emitter";
import { notifyRoles } from "./notify";

/**
 * Eventos del negocio (v4): además de la auditoría, cada operación importante avisa en
 * tiempo real a quien le interesa. Una falla al notificar nunca tumba la operación,
 * que ya quedó guardada: se registra en el log y sigue.
 */
const LOW_STOCK_THRESHOLD = 5;

const money = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

const safe = (label: string, fn: () => Promise<unknown>): void => {
  void fn().catch((err: unknown) => console.error(`No se pudo notificar ${label}:`, err));
};

/** Avisa a todas las pestañas que un recurso cambió para que refresquen sus datos. */
export const broadcastChange = (resource: string, actorId?: number): void => {
  emitToAll("datos:cambio", { resource, actorId: actorId ?? null, at: new Date().toISOString() });
};

export const onSaleRegistered = (sale: SaleResponse & { lines?: { productId: number }[] }, actorId: number): void => {
  safe("la venta", async () => {
    const tipo = sale.paymentType === "CREDIT" ? "a crédito" : "de contado";
    const quien = sale.customerName ?? "cliente de mostrador";
    await notifyRoles([Roles.ADMIN], {
      kind: NotificationKinds.SALE,
      message: `Venta ${sale.invoiceNumber} ${tipo} por ${money(sale.total)} · ${quien} (${sale.username})`,
      link: "/ventas",
    }, actorId);
    const ids = (sale.lines ?? []).map((l) => l.productId);
    if (ids.length === 0) return;
    const { rows } = await db.query<{ name: string; stock: number }>(
      `SELECT name, stock FROM products WHERE id = ANY($1::bigint[]) AND stock <= $2 ORDER BY stock`,
      [ids, LOW_STOCK_THRESHOLD],
    );
    for (const p of rows) {
      await notifyRoles([Roles.ADMIN, Roles.WAREHOUSE], {
        kind: NotificationKinds.LOW_STOCK,
        message: p.stock === 0 ? `${p.name} se agotó` : `${p.name} quedó con ${p.stock} unidades`,
        link: "/inventario",
      });
    }
  });
};

export const onSaleVoided = (sale: SaleResponse, actorId: number): void => {
  safe("la anulación", () => notifyRoles([Roles.ADMIN, Roles.SALES], {
    kind: NotificationKinds.SALE_VOIDED,
    message: `Se anuló la venta ${sale.invoiceNumber} por ${money(sale.total)}`,
    link: "/ventas",
  }, actorId));
};

export const onPaymentRegistered = (customerName: string, amount: number, actorId: number): void => {
  safe("el abono", () => notifyRoles([Roles.ADMIN], {
    kind: NotificationKinds.PAYMENT,
    message: `Abono de ${money(amount)} de ${customerName}`,
    link: "/clientes",
  }, actorId));
};

export const onStockReceived = (productName: string, quantity: number, actorId: number, supplierName?: string): void => {
  safe("la entrada", () => notifyRoles([Roles.ADMIN, Roles.WAREHOUSE], {
    kind: NotificationKinds.PURCHASE,
    message: `Entraron ${quantity} u. de ${productName}${supplierName ? ` de ${supplierName}` : ""}`,
    link: "/lotes",
  }, actorId));
};

export const onScenarioCreated = (scenario: ScenarioSummaryResponse, actorId: number): void => {
  safe("el escenario", () => notifyRoles([Roles.ADMIN], {
    kind: NotificationKinds.SCENARIO,
    message: `Nuevo escenario de ampliación: ${scenario.name} (${scenario.username})`,
    link: `/finanzas?escenario=${scenario.id}`,
  }, actorId));
};

export const onContactReceived = (name: string): void => {
  safe("el contacto", () => notifyRoles([Roles.ADMIN], {
    kind: NotificationKinds.CONTACT,
    message: `Nuevo mensaje de contacto de ${name}`,
    link: "/contactos",
  }));
};
