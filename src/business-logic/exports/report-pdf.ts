import type { InventoryReport, ReceivablesReport, SalesReport, SalesReportByDayRow, SalesReportByProductRow } from "../reports/index";
import {
  C, NA, ND, SR,
  barChart, createPdf, criteria, dateEs, dateShort, donut, finish, findings, hbarChart, header, int, kpis, lineChart, money, moneyShort,
  orND, pct, ratio, runBlocks, sectionTitle, summaryBox, table,
  type Block, type BlockPlan, type Finding, type Generator,
} from "./pdf-theme";

/**
 * Reportes PDF (v4.4): cada reporte es una lista de bloques sobre la plantilla común de `pdf-theme`.
 * Las funciones reciben los datos ya consultados (no tocan la base), así se pueden probar con datos
 * de ejemplo. Toda cifra, hallazgo o pendiente se calcula a partir de esos datos; si falta información
 * el bloque muestra un estado vacío en lugar de inventar valores.
 */

const share = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null);
const names = (list: string[], max = 3): string => (list.length <= max ? list.join(", ") : `${list.slice(0, max).join(", ")} y ${list.length - max} más`);

/** Número de días del periodo, inclusive. */
const daysInclusive = (from: string, to: string): number => {
  const a = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.max(0, Math.round((b - a) / 86_400_000) + 1);
};

/** Fechas (YYYY-MM-DD) del periodo sin ventas. */
const missingDays = (from: string, to: string, present: Set<string>): string[] => {
  const out: string[] = [];
  const end = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  for (let t = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10))); t <= end; t += 86_400_000) {
    const iso = new Date(t).toISOString().slice(0, 10);
    if (!present.has(iso)) out.push(iso);
  }
  return out;
};

// ------------------------------------------------------------------ Ventas

export type SalesPdfInput = { report: SalesReport; byDay: SalesReportByDayRow[]; byProduct: SalesReportByProductRow[]; groupBy: "day" | "product" };

export const buildSalesPdf = async (inp: SalesPdfInput, by: Generator, generatedAt = new Date(), plan?: BlockPlan): Promise<Buffer> => {
  const { report: r, byDay, byProduct, groupBy } = inp;
  const { doc, done } = createPdf("Reporte de ventas");
  const has = r.salesCount > 0;
  const avgTicket = has ? r.total / r.salesCount : null;
  const creditShare = share(r.creditTotal, r.total);
  const cashShare = share(r.cashTotal, r.total);
  const top = byProduct[0];
  const topShare = top ? share(top.total, r.total) : null;
  const bestDay = byDay.reduce<SalesReportByDayRow | undefined>((b, d) => (!b || d.total > b.total ? d : b), undefined);
  const gaps = missingDays(r.from, r.to, new Set(byDay.map((d) => d.date)));
  const nDays = daysInclusive(r.from, r.to);

  header(doc, "Reporte de ventas", `Ventas completadas del ${dateEs(r.from)} al ${dateEs(r.to)}, sin incluir las anuladas, agrupadas ${groupBy === "day" ? "por día" : "por producto"}.`, by, generatedAt, {
    period: `${dateShort(r.from)} – ${dateShort(r.to)} (${nDays} ${nDays === 1 ? "día" : "días"})`,
    context: `Ventas no anuladas · por ${groupBy === "day" ? "día" : "producto"}`,
  });

  const items: Finding[] = [];
  if (has) {
    if (bestDay) items.push({ tone: "good", title: "Día de mayor venta", text: `${dateEs(bestDay.date)} con ${money(bestDay.total)} en ${int(bestDay.salesCount)} ${bestDay.salesCount === 1 ? "venta" : "ventas"}.` });
    if (top && topShare !== null && byProduct.length > 1 && topShare >= 0.4) items.push({ tone: "warn", title: "Venta concentrada en un producto", text: `${top.productName} aporta ${money(top.total)}, el ${pct(topShare)} del total vendido, de ${int(byProduct.length)} productos con venta.` });
    if (creditShare !== null && creditShare >= 0.5) items.push({ tone: "warn", title: "Más de la mitad de la venta fue a crédito", text: `${money(r.creditTotal)} a crédito frente a ${money(r.cashTotal)} de contado (${pct(creditShare)} del total). Esa parte pasa a cartera.` });
    if (gaps.length > 0) items.push({ tone: "neutral", title: `${int(gaps.length)} ${gaps.length === 1 ? "día" : "días"} del periodo sin ventas registradas`, text: `${names(gaps.map(dateShort), 6)}. Los días sin ventas no aparecen en el gráfico por día.` });
  }

  const blocks: Block[] = [
    {
      id: "summary",
      render: () => {
        summaryBox(
          doc,
          has
            ? [
                `Entre el ${dateEs(r.from)} y el ${dateEs(r.to)} se registraron ${int(r.salesCount)} ventas por ${money(r.total)} (${int(r.units)} unidades).`,
                `De contado: ${money(r.cashTotal)} (${pct(cashShare)}). A crédito: ${money(r.creditTotal)} (${pct(creditShare)}).`,
                ...(top && topShare !== null ? [`Producto con mayor venta: ${top.productName}, ${money(top.total)} (${pct(topShare)} del total).`] : []),
              ]
            : [`No se registraron ventas completadas entre el ${dateEs(r.from)} y el ${dateEs(r.to)}. Las ventas anuladas no se cuentan.`],
        );
      },
    },
    {
      id: "kpis",
      render: () => {
        kpis(doc, [
          { label: "Total vendido", value: money(r.total), hint: "COP, ventas no anuladas" },
          { label: "Ventas", value: int(r.salesCount), hint: "documentos de venta" },
          { label: "Unidades", value: int(r.units), hint: "suma de cantidades" },
          { label: "Ticket promedio", value: orND(avgTicket, money), hint: has ? "total ÷ ventas" : "sin ventas en el periodo" },
          { label: "De contado", value: moneyShort(r.cashTotal), hint: cashShare === null ? undefined : `${pct(cashShare)} del total` },
          { label: "A crédito", value: moneyShort(r.creditTotal), hint: creditShare === null ? undefined : `${pct(creditShare)} del total`, tone: r.creditTotal > 0 ? "warn" : "neutral" },
        ]);
      },
    },
    {
      id: "by-day",
      render: () => {
        sectionTitle(doc, "Evolución de la venta", 200);
        barChart(doc, byDay.map((d) => ({ label: d.date.slice(5).replace("-", "/"), value: d.total })), { title: "Venta total por día", caption: "Pesos colombianos (COP) por día · solo días con ventas", empty: "No hay ventas diarias para graficar en este periodo." });
      },
    },
    {
      id: "mix",
      when: has,
      render: () => {
        sectionTitle(doc, "Contado frente a crédito", 160);
        donut(doc, [{ label: "De contado", value: r.cashTotal }, { label: "A crédito", value: r.creditTotal }], { title: "Participación en el valor vendido", caption: "COP y porcentaje del total", format: money });
      },
    },
    {
      id: "ranking",
      render: () => {
        sectionTitle(doc, "Productos más vendidos", 150);
        hbarChart(doc, byProduct.slice(0, 10).map((p) => ({ label: p.productName, value: p.total })), { title: byProduct.length > 0 ? `Los ${Math.min(10, byProduct.length)} productos con mayor venta` : undefined, caption: "COP en el periodo", empty: "No hay ventas por producto en este periodo." });
      },
    },
    {
      id: "findings",
      render: () => {
        sectionTitle(doc, "Hallazgos del periodo", 90, "Cada hallazgo se calcula con las cifras de este reporte.");
        findings(doc, items, has ? "Sin hallazgos que reportar: no hay concentración, crédito alto ni días sin ventas en el periodo." : "No hay ventas en el periodo, por lo que no se generan hallazgos.");
      },
    },
    {
      id: "detail",
      render: () => {
        sectionTitle(doc, groupBy === "day" ? "Detalle por día" : "Detalle por producto", 110);
        if (groupBy === "day") {
          table(
            doc,
            [{ title: "Fecha", width: 2 }, { title: "Ventas", width: 1.1, align: "right" }, { title: "Unidades", width: 1.3, align: "right" }, { title: "Total", width: 2, align: "right" }, { title: "% del total", width: 1.5, align: "right" }],
            byDay.map((d) => [dateShort(d.date), int(d.salesCount), int(d.units), money(d.total), orND(share(d.total, r.total), pct)]),
            { totals: ["Total del periodo", int(byDay.reduce((s, d) => s + d.salesCount, 0)), int(byDay.reduce((s, d) => s + d.units, 0)), money(byDay.reduce((s, d) => s + d.total, 0)), has ? pct(1) : ND], empty: "Sin ventas en el periodo." },
          );
        } else {
          table(
            doc,
            [{ title: "SKU", width: 1 }, { title: "Producto", width: 4 }, { title: "Ventas", width: 1.1, align: "right" }, { title: "Unidades", width: 1.3, align: "right" }, { title: "Total", width: 1.7, align: "right" }, { title: "% del total", width: 1.5, align: "right" }],
            byProduct.map((p) => [p.sku, p.productName, int(p.salesCount), int(p.units), money(p.total), orND(share(p.total, r.total), pct)]),
            { totals: ["", "Total del periodo", NA, int(byProduct.reduce((s, p) => s + p.units, 0)), money(byProduct.reduce((s, p) => s + p.total, 0)), has ? pct(1) : ND], empty: "Sin ventas en el periodo." },
          );
        }
      },
    },
    {
      id: "criteria",
      render: () => {
        criteria(doc, [
          "Solo ventas completadas; las anuladas no se cuentan. Fechas del periodo inclusive.",
          "Total vendido = suma de los totales de línea. Ticket promedio = total vendido ÷ número de ventas.",
          ...(groupBy === "product" ? ["En el detalle por producto, «Ventas» no se suma (N/A): una misma venta puede incluir varios productos."] : []),
          "Los porcentajes se calculan sobre el total vendido del periodo. La factura electrónica ante la DIAN sigue en el software del negocio.",
        ]);
      },
    },
  ];
  runBlocks(blocks, plan);
  finish(doc, "Reporte de ventas");
  return done;
};

// ------------------------------------------------------------------ Inventario

export const buildInventoryPdf = async (r: InventoryReport, by: Generator, generatedAt = new Date(), plan?: BlockPlan): Promise<Buffer> => {
  const { doc, done } = createPdf("Reporte de inventario");
  const days = r.expiringDays;
  const empty = r.products === 0;
  const rowsCost = r.byCategory.reduce((s, c) => s + c.costValue, 0);
  const rowsSale = r.byCategory.reduce((s, c) => s + c.saleValue, 0);
  const diff = r.saleValue - r.costValue;
  const noProducts = r.byCategory.filter((c) => c.products === 0).map((c) => c.categoryName);
  const topCat = [...r.byCategory].sort((a, b) => b.costValue - a.costValue)[0];
  const topCatShare = topCat ? share(topCat.costValue, rowsCost) : null;

  header(doc, "Reporte de inventario", `Existencias valorizadas y lotes por vencer al corte del ${dateEs(r.asOf)}.`, by, generatedAt, {
    period: `Corte al ${dateShort(r.asOf)}`,
    context: `Vencimientos a ${days} días`,
  });

  const items: Finding[] = [];
  if (r.expired.batches > 0) items.push({ tone: "bad", title: `${int(r.expired.batches)} ${r.expired.batches === 1 ? "lote vencido" : "lotes vencidos"} con existencia`, text: `${int(r.expired.units)} unidades por ${money(r.expired.costValue)} al costo${r.costValue > 0 ? ` (${pct(r.expired.costValue / r.costValue)} del inventario al costo)` : ""}. Pendiente: revisar y dar de baja o devolver.` });
  if (r.expiringSoon.batches > 0) items.push({ tone: "warn", title: `${int(r.expiringSoon.batches)} ${r.expiringSoon.batches === 1 ? "lote vence" : "lotes vencen"} en los próximos ${days} días`, text: `${int(r.expiringSoon.units)} unidades por ${money(r.expiringSoon.costValue)} al costo${r.costValue > 0 ? ` (${pct(r.expiringSoon.costValue / r.costValue)} del inventario al costo)` : ""}.` });
  if (r.outOfStock > 0) items.push({ tone: "warn", title: `${int(r.outOfStock)} ${r.outOfStock === 1 ? "producto activo agotado" : "productos activos agotados"}`, text: `Tienen existencia en cero entre ${int(r.activeProducts)} productos activos.` });
  if (noProducts.length > 0) items.push({ tone: "neutral", title: `${int(noProducts.length)} ${noProducts.length === 1 ? "línea sin productos" : "líneas sin productos"}`, text: names(noProducts, 5) + "." });
  if (topCat && topCatShare !== null && topCatShare >= 0.5 && r.byCategory.length > 1) items.push({ tone: "neutral", title: "Inventario concentrado en una línea", text: `${topCat.categoryName} representa ${pct(topCatShare)} del valor al costo (${money(topCat.costValue)}).` });
  if (Math.abs(rowsCost - r.costValue) > 1) items.push({ tone: "warn", title: "La suma por línea no coincide con el total", text: `Por línea suman ${money(rowsCost)} al costo y el total general es ${money(r.costValue)}; la diferencia es de ${money(Math.abs(rowsCost - r.costValue))}. Conviene revisarla.` });

  const blocks: Block[] = [
    {
      id: "summary",
      render: () => {
        summaryBox(
          doc,
          empty
            ? [`Al ${dateEs(r.asOf)} no hay productos registrados, por lo que no hay inventario que valorizar.`]
            : [
                `Al ${dateEs(r.asOf)} hay ${int(r.activeProducts)} productos activos (${int(r.products)} registrados) y ${int(r.units)} unidades en existencia, valorizadas en ${money(r.costValue)} al costo de cada lote y ${money(r.saleValue)} a precio de venta.`,
                `Vencimientos: ${int(r.expired.batches)} lotes vencidos con existencia (${money(r.expired.costValue)} al costo) y ${int(r.expiringSoon.batches)} que vencen en los próximos ${days} días (${money(r.expiringSoon.costValue)}).`,
              ],
        );
      },
    },
    {
      id: "kpis",
      render: () => {
        kpis(doc, [
          { label: "Valor al costo", value: money(r.costValue), hint: "suma de lotes" },
          { label: "A precio de venta", value: money(r.saleValue), hint: "existencia × precio vigente" },
          { label: "Precio menos costo", value: money(diff), hint: r.costValue > 0 ? `${pct(diff / r.costValue)} sobre el costo` : "costo en cero" },
          { label: "Unidades", value: int(r.units), hint: `${int(r.products)} productos registrados` },
          { label: "Productos activos", value: int(r.activeProducts) },
          { label: "Agotados", value: int(r.outOfStock), hint: "activos con existencia 0", tone: r.outOfStock > 0 ? "warn" : "good" },
          { label: `Por vencer (${days} d)`, value: `${int(r.expiringSoon.batches)} lotes`, hint: money(r.expiringSoon.costValue), tone: r.expiringSoon.batches > 0 ? "warn" : "good" },
          { label: "Vencidos", value: `${int(r.expired.batches)} lotes`, hint: money(r.expired.costValue), tone: r.expired.batches > 0 ? "bad" : "good" },
        ]);
      },
    },
    {
      id: "by-category",
      when: !empty,
      render: () => {
        sectionTitle(doc, "Valor por línea de producto", 190);
        hbarChart(doc, r.byCategory.filter((c) => c.costValue > 0).sort((a, b) => b.costValue - a.costValue).map((c) => ({ label: c.categoryName, value: c.costValue })), { title: "Inventario al costo por línea", caption: "COP, de mayor a menor · solo líneas con valor", empty: "Ninguna línea tiene inventario valorizado al costo." });
      },
    },
    {
      id: "mix",
      when: !empty,
      render: () => {
        sectionTitle(doc, "Participación por línea", 160);
        donut(doc, r.byCategory.filter((c) => c.saleValue > 0).map((c) => ({ label: c.categoryName, value: c.saleValue })), { title: "Participación a precio de venta", caption: "COP y porcentaje del valor a precio de venta", format: money });
      },
    },
    {
      id: "findings",
      render: () => {
        sectionTitle(doc, "Alertas y pendientes", 90, "Se generan con las cifras de este reporte.");
        findings(doc, items, empty ? "No hay productos registrados: no hay alertas que reportar." : "Sin alertas: no hay lotes vencidos ni por vencer, ni productos activos agotados.");
      },
    },
    {
      id: "detail",
      render: () => {
        sectionTitle(doc, "Detalle por línea", 110);
        table(
          doc,
          [{ title: "Línea", width: 3 }, { title: "Productos", width: 1.3, align: "right" }, { title: "Unidades", width: 1.3, align: "right" }, { title: "Al costo", width: 1.6, align: "right" }, { title: "A precio de venta", width: 1.8, align: "right" }, { title: "% del costo", width: 1.4, align: "right" }],
          r.byCategory.map((c) => [c.categoryName, int(c.products), int(c.units), money(c.costValue), money(c.saleValue), orND(share(c.costValue, rowsCost), pct)]),
          { totals: ["Total por línea", int(r.byCategory.reduce((s, c) => s + c.products, 0)), int(r.byCategory.reduce((s, c) => s + c.units, 0)), money(rowsCost), money(rowsSale), rowsCost > 0 ? pct(1) : ND], empty: "No hay líneas de producto registradas." },
        );
      },
    },
    {
      id: "criteria",
      render: () => {
        criteria(doc, [
          "Valor al costo = unidades restantes de cada lote × costo unitario de ese lote. Las ventas descuentan primero el lote que vence antes (FEFO).",
          "Valor a precio de venta = existencia del producto × precio de venta vigente. Se calcula sobre otra base que el costo; la diferencia entre ambos no es una utilidad realizada.",
          `Por vencer = lotes con existencia que vencen entre el corte y los próximos ${days} días. Vencido = fecha de vencimiento anterior al corte.`,
          "Agotado = producto activo con existencia en cero.",
        ]);
      },
    },
  ];
  runBlocks(blocks, plan);
  finish(doc, "Reporte de inventario");
  return done;
};

// ------------------------------------------------------------------ Cartera

export const buildReceivablesPdf = async (r: ReceivablesReport, by: Generator, today: string, generatedAt = new Date(), plan?: BlockPlan): Promise<Buffer> => {
  const { doc, done } = createPdf("Reporte de cartera");
  const empty = r.items.length === 0;
  const onTime = r.totalBalance - r.overdueBalance;
  const withLimit = r.items.filter((i) => i.creditLimit > 0);
  const limitSum = withLimit.reduce((s, i) => s + i.creditLimit, 0);
  const balanceWithLimit = withLimit.reduce((s, i) => s + i.balance, 0);
  const useAll = share(balanceWithLimit, limitSum);
  const overLimit = withLimit.filter((i) => i.balance > i.creditLimit);
  const noLimit = r.items.filter((i) => i.creditLimit <= 0);
  const overdue = r.items.filter((i) => i.overdue);
  const noPayments = r.items.filter((i) => i.lastPaymentAt === null);
  const top3 = r.items.slice(0, 3).reduce((s, i) => s + i.balance, 0);
  const top3Share = share(top3, r.totalBalance);

  header(doc, "Reporte de cartera", `Clientes con saldo pendiente al ${dateEs(today)}. Cartera vencida: última venta a crédito con más de ${r.overdueDays} días.`, by, generatedAt, {
    period: `Corte al ${dateShort(today)}`,
    context: `Vencida a más de ${r.overdueDays} días`,
  });

  const items: Finding[] = [];
  if (overdue.length > 0) items.push({ tone: "bad", title: `${int(overdue.length)} ${overdue.length === 1 ? "cliente con cartera vencida" : "clientes con cartera vencida"}`, text: `${money(r.overdueBalance)} (${pct(share(r.overdueBalance, r.totalBalance))} de la cartera). Mayores saldos vencidos: ${names(overdue.slice(0, 3).map((i) => `${i.name} (${money(i.balance)})`), 3)}. Pendiente de cobro.` });
  if (overLimit.length > 0) items.push({ tone: "bad", title: `${int(overLimit.length)} ${overLimit.length === 1 ? "cliente supera" : "clientes superan"} su cupo`, text: names(overLimit.map((i) => `${i.name}: saldo ${money(i.balance)} sobre cupo ${money(i.creditLimit)}`), 3) + "." });
  if (noLimit.length > 0) items.push({ tone: "warn", title: `${int(noLimit.length)} ${noLimit.length === 1 ? "cliente con saldo y sin cupo asignado" : "clientes con saldo y sin cupo asignado"}`, text: `${names(noLimit.map((i) => i.name), 4)}. El uso del cupo no aplica (N/A) para ellos.` });
  if (noPayments.length > 0) items.push({ tone: "neutral", title: `${int(noPayments.length)} ${noPayments.length === 1 ? "cliente sin abonos registrados" : "clientes sin abonos registrados"}`, text: `${names(noPayments.map((i) => i.name), 4)}.` });
  if (top3Share !== null && r.items.length > 3 && top3Share >= 0.6) items.push({ tone: "neutral", title: "Cartera concentrada en pocos clientes", text: `Los 3 mayores saldos suman ${money(top3)}, el ${pct(top3Share)} de la cartera.` });

  const blocks: Block[] = [
    {
      id: "summary",
      render: () => {
        summaryBox(
          doc,
          empty
            ? [`Al ${dateEs(today)} ningún cliente tiene saldo pendiente.`]
            : [
                `${int(r.customersWithBalance)} ${r.customersWithBalance === 1 ? "cliente tiene" : "clientes tienen"} saldo pendiente por ${money(r.totalBalance)}.`,
                `${int(r.overdueCustomers)} ${r.overdueCustomers === 1 ? "está vencido" : "están vencidos"}: ${money(r.overdueBalance)} (${pct(share(r.overdueBalance, r.totalBalance))} de la cartera). Al día: ${money(onTime)}.`,
              ],
        );
      },
    },
    {
      id: "kpis",
      render: () => {
        kpis(doc, [
          { label: "Cartera total", value: money(r.totalBalance), hint: `${int(r.customersWithBalance)} clientes con saldo` },
          { label: "Vencida", value: money(r.overdueBalance), hint: `${int(r.overdueCustomers)} clientes`, tone: r.overdueCustomers > 0 ? "bad" : "good" },
          { label: "Al día", value: money(onTime), tone: "good" },
          { label: "% vencida", value: orND(share(r.overdueBalance, r.totalBalance), pct), hint: "vencida ÷ cartera total", tone: r.overdueBalance > 0 ? "warn" : "good" },
          { label: "Uso del cupo", value: orND(useAll, pct), hint: withLimit.length > 0 ? `${int(withLimit.length)} clientes con cupo` : "ningún cliente con cupo", tone: useAll !== null && useAll >= 0.9 ? "warn" : "neutral" },
        ]);
      },
    },
    {
      id: "by-customer",
      when: !empty,
      render: () => {
        sectionTitle(doc, "Saldo por cliente", 190);
        hbarChart(doc, r.items.slice(0, 12).map((i) => ({ label: i.name, value: i.balance, color: i.overdue ? C.bad : C.green })), { title: `Los ${Math.min(12, r.items.length)} mayores saldos`, caption: "COP · rojo = cartera vencida, verde = al día" });
      },
    },
    {
      id: "findings",
      render: () => {
        sectionTitle(doc, "Alertas y pendientes de cobro", 90, "Se generan con las cifras de este reporte.");
        findings(doc, items, empty ? "No hay saldos pendientes: no hay alertas que reportar." : "Sin alertas: ningún cliente vencido, sin cupo ni sobre su cupo.");
      },
    },
    {
      id: "detail",
      render: () => {
        sectionTitle(doc, "Detalle por cliente", 110);
        table(
          doc,
          [{ title: "Cliente", width: 3 }, { title: "Cupo", width: 1.4, align: "right" }, { title: "Saldo", width: 1.4, align: "right" }, { title: "Uso", width: 1.1, align: "right" }, { title: "Últ. crédito", width: 1.3 }, { title: "Últ. abono", width: 1.3 }, { title: "Estado", width: 1.1, align: "center" }],
          r.items.map((i) => [i.name, money(i.creditLimit), money(i.balance), i.creditLimit > 0 ? pct(i.balance / i.creditLimit) : NA, i.lastCreditSaleAt ? dateShort(i.lastCreditSaleAt) : SR, i.lastPaymentAt ? dateShort(i.lastPaymentAt) : SR, i.overdue ? "Vencida" : "Al día"]),
          { tag: (row, col) => (col === 6 ? (row[6] === "Vencida" ? "bad" : "good") : undefined), totals: ["Total", money(limitSum), money(r.totalBalance), orND(useAll, pct), NA, NA, NA], empty: "Ningún cliente tiene saldo pendiente." },
        );
      },
    },
    {
      id: "criteria",
      render: () => {
        criteria(doc, [
          `Cartera vencida = saldo de clientes cuya última venta a crédito tiene más de ${r.overdueDays} días. «Al día» = cartera total - vencida.`,
          "Uso del cupo = saldo ÷ cupo, solo para clientes con cupo asignado; sin cupo aparece N/A. En el total, uso = saldo de clientes con cupo ÷ suma de sus cupos.",
          "«Sin registro» indica que el cliente no tiene ese evento (venta a crédito o abono) en el sistema.",
        ]);
      },
    },
  ];
  runBlocks(blocks, plan);
  finish(doc, "Reporte de cartera");
  return done;
};

// ------------------------------------------------------------------ Escenario financiero

export type ScenarioPdfInput = {
  name: string;
  results: {
    npv: number;
    irr: number | null;
    paybackSimple: number | null;
    benefitCostRatio: number;
    installment: number;
    coverageIncremental: number | null;
    totalInvestment: number;
    credit: number;
    flows: number[];
  };
  tornado: { variable: string; label: string; npvLow: number; npvHigh: number }[];
};

export const buildScenarioPdf = async (s: ScenarioPdfInput, by: Generator, generatedAt = new Date(), plan?: BlockPlan): Promise<Buffer> => {
  const { doc, done } = createPdf("Evaluación financiera");
  const res = s.results;
  const good = res.npv > 0;
  const horizon = Math.max(0, res.flows.length - 1);
  const cumulative: number[] = [];
  res.flows.reduce((acc, f, i) => {
    cumulative[i] = acc + f;
    return acc + f;
  }, 0);
  const coverageOk = res.coverageIncremental !== null && res.coverageIncremental >= 1;
  const swing = s.tornado.map((t) => ({ ...t, amplitude: Math.abs(t.npvHigh - t.npvLow) }));
  const ranked = [...swing].filter((t) => t.amplitude > 0).sort((a, b) => b.amplitude - a.amplitude);
  const flips = good ? swing.filter((t) => t.npvLow < 0 || t.npvHigh < 0) : [];

  header(doc, "Evaluación de la ampliación", `Escenario «${s.name}». Cifras calculadas por el motor financiero con supuestos académicos por validar.`, by, generatedAt, {
    period: `Horizonte de ${horizon} ${horizon === 1 ? "año" : "años"}`,
    context: s.name,
  });

  const items: Finding[] = [];
  items.push(good
    ? { tone: "good", title: "El proyecto crea valor", text: `El VPN es positivo (${money(res.npv)})${res.irr !== null ? ` y la TIR es ${pct(res.irr)}` : ""}.` }
    : { tone: "bad", title: "El proyecto no crea valor con estos supuestos", text: `El VPN es ${money(res.npv)}${res.irr !== null ? ` y la TIR es ${pct(res.irr)}` : ""}.` });
  if (res.coverageIncremental !== null) items.push(coverageOk
    ? { tone: "good", title: "La ampliación cubre su propia cuota", text: `Cobertura incremental de ${ratio(res.coverageIncremental)} sobre una cuota mensual de ${money(res.installment)}.` }
    : { tone: "warn", title: "La ampliación no alcanza a cubrir toda la cuota", text: `Cobertura incremental de ${ratio(res.coverageIncremental)} sobre una cuota mensual de ${money(res.installment)}; el negocio actual pondría la diferencia.` });
  if (ranked[0]) items.push({ tone: "neutral", title: `Variable más sensible: ${ranked[0].label}`, text: `Mover ${ranked[0].label.toLowerCase()} ±20 % lleva el VPN de ${money(ranked[0].npvLow)} a ${money(ranked[0].npvHigh)} (amplitud ${money(ranked[0].amplitude)}).` });
  flips.forEach((t) => items.push({ tone: "warn", title: `Con ${t.label.toLowerCase()} ±20 % el VPN puede volverse negativo`, text: `VPN con -20 %: ${money(t.npvLow)}; con +20 %: ${money(t.npvHigh)}.` }));
  if (res.paybackSimple === null) items.push({ tone: "neutral", title: "Recuperación simple no disponible", text: "El motor no devolvió un plazo de recuperación para este escenario (N/D)." });

  const blocks: Block[] = [
    {
      id: "summary",
      render: () => {
        summaryBox(doc, [
          good
            ? `La ampliación crea valor: el VPN es positivo (${money(res.npv)})${res.irr !== null ? ` y la TIR es ${pct(res.irr)}` : ""}. Inversión total: ${money(res.totalInvestment)}, de la cual ${money(res.credit)} se financia con crédito.`
            : `Con estos supuestos la ampliación no crea valor (VPN ${money(res.npv)}). Inversión total: ${money(res.totalInvestment)}; crédito: ${money(res.credit)}. Revise la sensibilidad antes de pedir el crédito.`,
          ...(res.coverageIncremental !== null ? [coverageOk ? "Lo que genera la ampliación paga su propia cuota." : "Lo que genera la ampliación no alcanza a cubrir toda la cuota; el negocio actual pondría la diferencia."] : []),
        ], "Veredicto");
      },
    },
    {
      id: "kpis",
      render: () => {
        kpis(doc, [
          { label: "VPN del proyecto", value: money(res.npv), hint: "valor presente neto", tone: good ? "good" : "bad" },
          { label: "TIR", value: pct(res.irr), hint: "tasa interna de retorno", tone: res.irr === null ? "neutral" : good ? "good" : "bad" },
          { label: "Relación B/C", value: ratio(res.benefitCostRatio, ""), hint: "beneficio ÷ costo" },
          { label: "Recuperación simple", value: orND(res.paybackSimple, (v) => `${v.toFixed(1).replace(".", ",")} años`), hint: "sin descontar" },
          { label: "Inversión total", value: money(res.totalInvestment), hint: `crédito ${money(res.credit)}` },
          { label: "Cuota mensual", value: money(res.installment), hint: `cobertura ${ratio(res.coverageIncremental)}`, tone: res.coverageIncremental === null ? "neutral" : coverageOk ? "good" : "warn" },
        ]);
      },
    },
    {
      id: "flows",
      when: res.flows.length > 1,
      render: () => {
        sectionTitle(doc, "Flujo de caja del proyecto", 200);
        barChart(doc, res.flows.map((f, i) => ({ label: `Año ${i}`, value: f })), { title: "Flujo neto por año", caption: "COP · el año 0 es la inversión (negativa, en rojo)", height: 140 });
        lineChart(doc, cumulative.map((v, i) => ({ label: `Año ${i}`, value: v })), { title: "Flujo acumulado", caption: "COP, sin descontar · cruza el cero cuando se recupera la inversión", height: 120 });
      },
    },
    {
      id: "flows-table",
      when: res.flows.length > 0,
      render: () => {
        sectionTitle(doc, "Flujo por año", 110);
        table(
          doc,
          [{ title: "Año", width: 1 }, { title: "Flujo neto", width: 2, align: "right" }, { title: "Flujo acumulado", width: 2, align: "right" }, { title: "Inversión", width: 1.6, align: "center" }],
          res.flows.map((f, i) => [`Año ${i}`, money(f), money(cumulative[i] ?? 0), (cumulative[i] ?? 0) >= 0 ? "Recuperada" : "Por recuperar"]),
          { tag: (row, col) => (col === 3 ? (row[3] === "Recuperada" ? "good" : "warn") : undefined), totals: ["Suma", money(res.flows.reduce((a, b) => a + b, 0)), NA, NA] },
        );
      },
    },
    {
      id: "tornado",
      render: () => {
        sectionTitle(doc, "Sensibilidad del VPN", 180, "Cada barra mueve una variable ±20 % y recalcula el VPN.");
        hbarChart(doc, ranked.map((t) => ({ label: t.label, value: t.amplitude })), { title: "Amplitud del VPN por variable", caption: "COP · diferencia entre el VPN con +20 % y con -20 %", empty: swing.length > 0 ? "Ninguna variable cambia el VPN al moverla ±20 %." : "No hay análisis de sensibilidad para este escenario." });
        if (swing.length > 0) table(doc, [{ title: "Variable", width: 2.4 }, { title: "VPN con -20 %", width: 1.6, align: "right" }, { title: "VPN con +20 %", width: 1.6, align: "right" }, { title: "Amplitud", width: 1.4, align: "right" }], swing.map((t) => [t.label, money(t.npvLow), money(t.npvHigh), money(t.amplitude)]));
      },
    },
    {
      id: "findings",
      render: () => {
        sectionTitle(doc, "Resultados relevantes", 90, "Se generan con las cifras de este escenario.");
        findings(doc, items);
      },
    },
    {
      id: "criteria",
      render: () => {
        criteria(doc, [
          "VPN, TIR, relación B/C y cuota las calcula el motor financiero del sistema con los supuestos del escenario; son supuestos académicos por validar.",
          "Flujo acumulado = suma de los flujos netos desde el año 0, sin descontar. «Recuperada» indica acumulado mayor o igual a cero.",
          "Cobertura incremental = flujo adicional que genera la ampliación ÷ cuota. N/D cuando el motor no la calcula.",
          "El sistema explica las consecuencias de cada alternativa; la decisión es de la gerencia.",
        ]);
      },
    },
  ];
  runBlocks(blocks, plan);
  finish(doc, "Evaluación financiera");
  return done;
};

