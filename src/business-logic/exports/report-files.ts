import ExcelJS from "exceljs";
import { salesReport, inventoryReport, receivablesReport, type SalesReport, type SalesReportByDayRow, type SalesReportByProductRow } from "../reports/index";
import { getScenario, getScenarioTornado } from "../financial/index";
import { C, barChart, createPdf, donut, finish, hbarChart, header, int, kpis, money, moneyShort, note, pct, sectionTitle, table, type Generator } from "./pdf-theme";

/**
 * Archivos de reportes (v4.2, como los reportes PDF y Excel de SoftUnity): cada reporte gerencial
 * se descarga como PDF con gráficos o como Excel con formato. Los datos vienen de las mismas
 * consultas de /reports; aquí solo se presentan.
 */
export type ExportFormat = "pdf" | "xlsx";
export type ExportFile = { filename: string; contentType: string; body: Buffer; description: string };

const CT = { pdf: "application/pdf", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } as const;

/** Fecha corta para tablas: 09/10/2026. */
const dateShort = (iso: string): string => { const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}/${y}`; };

const dateEs = (iso: string): string => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
};

// ---------------------------------------------------------------- Excel común

const newBook = (): ExcelJS.Workbook => {
  const book = new ExcelJS.Workbook();
  book.creator = "Mi Tierrita SIG";
  book.created = new Date();
  return book;
};

/** Hoja con título, línea de «generado por», encabezado negro, filas y formato de moneda. */
const sheet = (book: ExcelJS.Workbook, name: string, title: string, by: Generator, cols: { header: string; key: string; width: number; money?: boolean; int?: boolean }[], rows: Record<string, unknown>[]) => {
  const ws = book.addWorksheet(name, { views: [{ state: "frozen", ySplit: 4 }] });
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
  ws.mergeCells(1, 1, 1, cols.length);
  ws.getCell(1, 1).value = `MI TIERRITA SIG · ${title.toUpperCase()}`;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  ws.getCell(1, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF121315" } };
  ws.getRow(1).height = 24;
  ws.mergeCells(2, 1, 2, cols.length);
  ws.getCell(2, 1).value = `Generado por ${by.name} (@${by.username}) el ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })} · registrado en la auditoría`;
  ws.getCell(2, 1).font = { italic: true, size: 9, color: { argb: "FF7B7F86" } };
  const head = ws.getRow(4);
  cols.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FF14F77B" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D1E20" } };
  });
  rows.forEach((r) => ws.addRow(r));
  cols.forEach((c, i) => {
    if (c.money) ws.getColumn(i + 1).numFmt = '"$"#,##0';
    if (c.int) ws.getColumn(i + 1).numFmt = "#,##0";
  });
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: cols.length } };
  return ws;
};

const xlsxFile = async (book: ExcelJS.Workbook, filename: string, description: string): Promise<ExportFile> => ({
  filename,
  contentType: CT.xlsx,
  body: Buffer.from(await book.xlsx.writeBuffer()),
  description,
});

// ---------------------------------------------------------------- Ventas

export const exportSales = async (from: string, to: string, groupBy: "day" | "product", format: ExportFormat, by: Generator): Promise<ExportFile> => {
  const r: SalesReport = await salesReport(from, to, groupBy);
  const label = `Reporte de ventas · ${format.toUpperCase()} · ${from} a ${to} · ${groupBy === "day" ? "por día" : "por producto"}`;
  const base = `ventas_${from}_${to}_${groupBy === "day" ? "por-dia" : "por-producto"}`;
  // los productos más vendidos siempre van, para el gráfico de ranking
  const byProduct = groupBy === "product" ? (r.rows as SalesReportByProductRow[]) : ((await salesReport(from, to, "product")).rows as SalesReportByProductRow[]);
  const byDay = groupBy === "day" ? (r.rows as SalesReportByDayRow[]) : ((await salesReport(from, to, "day")).rows as SalesReportByDayRow[]);

  if (format === "xlsx") {
    const book = newBook();
    const ws = sheet(book, "Resumen", "Reporte de ventas", by, [{ header: "Indicador", key: "k", width: 34 }, { header: "Valor", key: "v", width: 22 }], []);
    for (const [k, v] of [["Periodo", `${from} a ${to}`], ["Ventas", r.salesCount], ["Unidades", r.units], ["Total vendido", r.total], ["De contado", r.cashTotal], ["A crédito", r.creditTotal]] as const) {
      const row = ws.addRow({ k, v });
      if (typeof v === "number" && k !== "Ventas" && k !== "Unidades") row.getCell(2).numFmt = '"$"#,##0';
    }
    sheet(book, "Por día", "Ventas por día", by, [{ header: "Fecha", key: "date", width: 14 }, { header: "Ventas", key: "salesCount", width: 10, int: true }, { header: "Unidades", key: "units", width: 11, int: true }, { header: "Total", key: "total", width: 16, money: true }], byDay);
    sheet(book, "Por producto", "Ventas por producto", by, [{ header: "SKU", key: "sku", width: 12 }, { header: "Producto", key: "productName", width: 44 }, { header: "Ventas", key: "salesCount", width: 10, int: true }, { header: "Unidades", key: "units", width: 11, int: true }, { header: "Total", key: "total", width: 16, money: true }], byProduct);
    return xlsxFile(book, `${base}.xlsx`, label);
  }

  const { doc, done } = createPdf("Reporte de ventas");
  header(doc, "Reporte de ventas", `Periodo del ${dateEs(from)} al ${dateEs(to)} · solo ventas no anuladas · agrupado ${groupBy === "day" ? "por día" : "por producto"}.`, by, new Date());
  kpis(doc, [
    { label: "Total vendido", value: moneyShort(r.total), hint: `${int(r.salesCount)} ventas` },
    { label: "Unidades", value: int(r.units) },
    { label: "Ticket promedio", value: moneyShort(r.salesCount ? r.total / r.salesCount : 0) },
    { label: "A crédito", value: moneyShort(r.creditTotal), hint: pct(r.total ? r.creditTotal / r.total : 0) + " del total", tone: "warn" },
  ]);
  sectionTitle(doc, "Ventas por día");
  barChart(doc, byDay.map((d) => ({ label: d.date.slice(5).replace("-", "/"), value: d.total })));
  sectionTitle(doc, "Contado frente a crédito");
  donut(doc, [{ label: "De contado", value: r.cashTotal }, { label: "A crédito", value: r.creditTotal }]);
  sectionTitle(doc, "Productos más vendidos");
  hbarChart(doc, byProduct.slice(0, 10).map((p) => ({ label: p.productName, value: p.total })));
  sectionTitle(doc, groupBy === "day" ? "Detalle por día" : "Detalle por producto");
  if (groupBy === "day") {
    table(doc, [{ title: "Fecha", width: 2 }, { title: "Ventas", width: 1, align: "right" }, { title: "Unidades", width: 1, align: "right" }, { title: "Total", width: 2, align: "right" }], byDay.map((d) => [dateShort(d.date), int(d.salesCount), int(d.units), money(d.total)]));
  } else {
    table(doc, [{ title: "SKU", width: 1 }, { title: "Producto", width: 4 }, { title: "Ventas", width: 1, align: "right" }, { title: "Unidades", width: 1, align: "right" }, { title: "Total", width: 1.6, align: "right" }], byProduct.map((p) => [p.sku, p.productName, int(p.salesCount), int(p.units), money(p.total)]));
  }
  note(doc, "Los totales los calcula el servidor a partir de las líneas de venta; la factura electrónica ante la DIAN sigue en el software del negocio.");
  finish(doc, "Reporte de ventas");
  return { filename: `${base}.pdf`, contentType: CT.pdf, body: await done, description: label };
};

// ---------------------------------------------------------------- Inventario

export const exportInventory = async (days: number, format: ExportFormat, by: Generator): Promise<ExportFile> => {
  const r = await inventoryReport(days);
  const label = `Reporte de inventario · ${format.toUpperCase()} · corte ${r.asOf} · vencimientos a ${days} días`;
  const base = `inventario_${r.asOf}_${days}-dias`;
  if (format === "xlsx") {
    const book = newBook();
    const ws = sheet(book, "Resumen", "Reporte de inventario", by, [{ header: "Indicador", key: "k", width: 36 }, { header: "Valor", key: "v", width: 22 }], []);
    for (const [k, v, m] of [["Corte", r.asOf, false], ["Productos activos", r.activeProducts, false], ["Unidades", r.units, false], ["Valor al costo", r.costValue, true], ["Valor a precio de venta", r.saleValue, true], ["Agotados", r.outOfStock, false], [`Lotes por vencer (${days} días)`, r.expiringSoon.batches, false], ["Costo por vencer", r.expiringSoon.costValue, true], ["Lotes vencidos", r.expired.batches, false], ["Costo vencido", r.expired.costValue, true]] as const) {
      const row = ws.addRow({ k, v });
      if (m) row.getCell(2).numFmt = '"$"#,##0';
    }
    sheet(book, "Por línea", "Inventario por línea", by, [{ header: "Línea", key: "categoryName", width: 30 }, { header: "Productos", key: "products", width: 11, int: true }, { header: "Unidades", key: "units", width: 11, int: true }, { header: "Valor al costo", key: "costValue", width: 18, money: true }, { header: "Valor a precio de venta", key: "saleValue", width: 22, money: true }], r.byCategory);
    return xlsxFile(book, `${base}.xlsx`, label);
  }
  const { doc, done } = createPdf("Reporte de inventario");
  header(doc, "Reporte de inventario", `Corte al ${dateEs(r.asOf)} · inventario valorizado por lote y vencimientos en los próximos ${days} días.`, by, new Date());
  kpis(doc, [
    { label: "Valor al costo", value: moneyShort(r.costValue), hint: `${int(r.units)} unidades` },
    { label: "A precio de venta", value: moneyShort(r.saleValue) },
    { label: `Por vencer (${days} d)`, value: `${int(r.expiringSoon.batches)} lotes`, hint: moneyShort(r.expiringSoon.costValue), tone: "warn" },
    { label: "Vencidos", value: `${int(r.expired.batches)} lotes`, hint: moneyShort(r.expired.costValue), tone: r.expired.batches ? "bad" : "good" },
  ]);
  sectionTitle(doc, "Valor por línea de producto");
  hbarChart(doc, r.byCategory.map((c) => ({ label: c.categoryName, value: c.costValue })));
  sectionTitle(doc, "Participación a precio de venta");
  donut(doc, r.byCategory.filter((c) => c.saleValue > 0).map((c) => ({ label: c.categoryName, value: c.saleValue })));
  sectionTitle(doc, "Detalle por línea");
  table(doc, [{ title: "Línea", width: 3 }, { title: "Productos", width: 1, align: "right" }, { title: "Unidades", width: 1, align: "right" }, { title: "Al costo", width: 1.6, align: "right" }, { title: "A precio de venta", width: 1.8, align: "right" }], r.byCategory.map((c) => [c.categoryName, int(c.products), int(c.units), money(c.costValue), money(c.saleValue)]));
  note(doc, `Agotados: ${int(r.outOfStock)} productos. El valor al costo usa el costo de cada lote; las ventas descuentan primero el lote que vence primero (FEFO).`);
  finish(doc, "Reporte de inventario");
  return { filename: `${base}.pdf`, contentType: CT.pdf, body: await done, description: label };
};

// ---------------------------------------------------------------- Cartera

export const exportReceivables = async (overdueDays: number, format: ExportFormat, by: Generator): Promise<ExportFile> => {
  const r = await receivablesReport(overdueDays);
  const today = new Date().toISOString().slice(0, 10);
  const label = `Reporte de cartera · ${format.toUpperCase()} · vencida a ${overdueDays} días`;
  const base = `cartera_${today}_${overdueDays}-dias`;
  const rows = r.items.map((i) => ({ name: i.name, creditLimit: i.creditLimit, balance: i.balance, use: i.creditLimit ? i.balance / i.creditLimit : 0, lastCreditSaleAt: i.lastCreditSaleAt?.slice(0, 10) ?? "", lastPaymentAt: i.lastPaymentAt?.slice(0, 10) ?? "", overdue: i.overdue ? "Vencida" : "Al día" }));
  if (format === "xlsx") {
    const book = newBook();
    const ws = sheet(book, "Cartera", "Reporte de cartera", by, [{ header: "Cliente", key: "name", width: 34 }, { header: "Cupo", key: "creditLimit", width: 15, money: true }, { header: "Saldo", key: "balance", width: 15, money: true }, { header: "Uso del cupo", key: "use", width: 13 }, { header: "Última venta a crédito", key: "lastCreditSaleAt", width: 20 }, { header: "Último abono", key: "lastPaymentAt", width: 14 }, { header: "Estado", key: "overdue", width: 11 }], rows);
    ws.getColumn(4).numFmt = "0%";
    return xlsxFile(book, `${base}.xlsx`, label);
  }
  const { doc, done } = createPdf("Reporte de cartera");
  header(doc, "Reporte de cartera", `Clientes con saldo pendiente. Se considera vencida la cartera cuya última venta a crédito tiene más de ${overdueDays} días.`, by, new Date());
  kpis(doc, [
    { label: "Cartera total", value: moneyShort(r.totalBalance), hint: `${int(r.customersWithBalance)} clientes` },
    { label: "Vencida", value: moneyShort(r.overdueBalance), hint: `${int(r.overdueCustomers)} clientes`, tone: r.overdueCustomers ? "bad" : "good" },
    { label: "Al día", value: moneyShort(r.totalBalance - r.overdueBalance), tone: "good" },
  ]);
  sectionTitle(doc, "Saldo por cliente");
  hbarChart(doc, r.items.slice(0, 12).map((i) => ({ label: i.name, value: i.balance, color: i.overdue ? C.bad : C.green })));
  sectionTitle(doc, "Detalle");
  table(doc, [{ title: "Cliente", width: 3 }, { title: "Cupo", width: 1.4, align: "right" }, { title: "Saldo", width: 1.4, align: "right" }, { title: "Uso", width: 0.8, align: "right" }, { title: "Últ. crédito", width: 1.3 }, { title: "Últ. abono", width: 1.3 }, { title: "Estado", width: 1 }], rows.map((x) => [x.name, money(x.creditLimit), money(x.balance), pct(x.use), x.lastCreditSaleAt ? dateShort(x.lastCreditSaleAt) : "—", x.lastPaymentAt ? dateShort(x.lastPaymentAt) : "—", x.overdue]));
  note(doc, "En rojo, los clientes con cartera vencida: conviene cobrar antes de autorizar más crédito.");
  finish(doc, "Reporte de cartera");
  return { filename: `${base}.pdf`, contentType: CT.pdf, body: await done, description: label };
};

// ---------------------------------------------------------------- Escenario financiero (DSS)

const TORNADO_LABEL: Record<string, string> = {
  grossMargin: "Margen bruto",
  salesIncrease: "Aumento de ventas",
  fixedInvestment: "Inversión fija",
  tmar: "TMAR",
  additionalExpensesMonth: "Gastos adicionales",
  inventoryTurnover: "Rotación de inventario",
  salvageValuePct: "Valor de salvamento",
  creditRateEA: "Tasa del crédito",
};

export const exportScenario = async (id: number, format: ExportFormat, by: Generator): Promise<ExportFile> => {
  const s = await getScenario(id);
  const t = await getScenarioTornado(id);
  const res = s.results as unknown as { npv: number; irr: number | null; paybackSimple: number | null; benefitCostRatio: number; installment: number; coverageIncremental: number | null; totalInvestment: number; credit: number; detail: { year: number; flow: number; margin: number; expenses: number }[]; flows: number[] };
  const label = `Escenario financiero · ${format.toUpperCase()} · ${s.name}`;
  const base = `escenario-${id}`;
  if (format === "xlsx") {
    const book = newBook();
    const ws = sheet(book, "Indicadores", `Escenario · ${s.name}`, by, [{ header: "Indicador", key: "k", width: 34 }, { header: "Valor", key: "v", width: 20 }], []);
    for (const [k, v, f] of [["Inversión total", res.totalInvestment, "$"], ["Crédito", res.credit, "$"], ["Cuota mensual", res.installment, "$"], ["VPN", res.npv, "$"], ["TIR", res.irr, "%"], ["Recuperación (años)", res.paybackSimple, ""], ["Relación B/C", res.benefitCostRatio, ""], ["Cobertura incremental de la cuota", res.coverageIncremental, "x"]] as const) {
      const row = ws.addRow({ k, v });
      row.getCell(2).numFmt = f === "$" ? '"$"#,##0' : f === "%" ? "0.00%" : "0.00";
    }
    sheet(book, "Flujo", "Flujo de caja del proyecto", by, [{ header: "Año", key: "year", width: 8 }, { header: "Flujo neto", key: "flow", width: 18, money: true }], res.flows.map((flow, year) => ({ year, flow })));
    sheet(book, "Tornado", "Sensibilidad del VPN (±20 %)", by, [{ header: "Variable", key: "v", width: 28 }, { header: "VPN con -20 %", key: "lo", width: 18, money: true }, { header: "VPN con +20 %", key: "hi", width: 18, money: true }], t.bars.map((b) => ({ v: TORNADO_LABEL[b.variable] ?? b.variable, lo: b.npvLow, hi: b.npvHigh })));
    return xlsxFile(book, `${base}.xlsx`, label);
  }
  const { doc, done } = createPdf("Evaluación financiera");
  header(doc, "Evaluación de la ampliación", `Escenario: ${s.name}. Cifras calculadas por el motor financiero con supuestos académicos por validar.`, by, new Date());
  const good = res.npv > 0;
  kpis(doc, [
    { label: "VPN del proyecto", value: moneyShort(res.npv), tone: good ? "good" : "bad" },
    { label: "TIR", value: pct(res.irr), tone: good ? "good" : "bad" },
    { label: "Cuota mensual", value: moneyShort(res.installment), hint: `Crédito ${moneyShort(res.credit)}` },
    { label: "Cobertura de la cuota", value: res.coverageIncremental === null ? "—" : `${res.coverageIncremental.toFixed(2).replace(".", ",")} x`, tone: (res.coverageIncremental ?? 0) >= 1 ? "good" : "warn" },
  ]);
  sectionTitle(doc, "Veredicto");
  doc.fillColor(C.ink).font("Helvetica").fontSize(10).text(
    good
      ? `La ampliación crea valor: el VPN es positivo (${money(res.npv)}) y la TIR (${pct(res.irr)}) supera la TMAR. ${(res.coverageIncremental ?? 0) >= 1 ? "Lo que genera la ampliación paga su propia cuota." : "Ojo: lo que genera la ampliación no alcanza a cubrir toda la cuota; el negocio actual pondría la diferencia."}`
      : `Con estos supuestos la ampliación no crea valor (VPN ${money(res.npv)}). Revise la sensibilidad antes de pedir el crédito.`,
    { width: 516 },
  );
  doc.moveDown(0.8);
  sectionTitle(doc, "Flujo de caja neto por año");
  barChart(doc, res.flows.map((f, i) => ({ label: `Año ${i}`, value: Math.max(0, f) })), { color: C.olive });
  note(doc, `Año 0: inversión de ${money(Math.abs(res.flows[0] ?? 0))} (se muestra en cero en el gráfico).`);
  sectionTitle(doc, "Sensibilidad del VPN (tornado ±20 %)");
  hbarChart(doc, t.bars.filter((b) => b.amplitude > 0).map((b) => ({ label: TORNADO_LABEL[b.variable] ?? b.variable, value: b.amplitude })), { format: moneyShort });
  table(doc, [{ title: "Variable", width: 2.4 }, { title: "VPN con -20 %", width: 1.6, align: "right" }, { title: "VPN con +20 %", width: 1.6, align: "right" }], t.bars.map((b) => [TORNADO_LABEL[b.variable] ?? b.variable, money(b.npvLow), money(b.npvHigh)]));
  note(doc, "El sistema explica las consecuencias de cada alternativa; la decisión es de la gerencia.");
  finish(doc, "Evaluación financiera");
  return { filename: `${base}.pdf`, contentType: CT.pdf, body: await done, description: label };
};
