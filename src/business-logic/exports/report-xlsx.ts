import ExcelJS from "exceljs";
import type { InventoryReport, ReceivablesReport, SalesReportByDayRow, SalesReportByProductRow } from "../reports/index";
import { dateShort, ND, NA, SR, stamp, type Generator } from "./pdf-theme";
import type { SalesPdfInput, ScenarioPdfInput } from "./report-pdf";

/**
 * Excel de los reportes (v4.4): mismo lenguaje que los PDF (paleta, encabezado institucional,
 * criterios) y las mismas cifras. Cada hoja trae título, periodo, quién y cuándo lo generó,
 * encabezado fijo con filtros, formatos numéricos consistentes, totales con fórmula y configuración
 * de impresión (horizontal, ajustada al ancho, encabezado repetido y «Página X de Y»).
 * Dato no disponible = «N/D»; no aplica = «N/A»; evento que nunca ocurrió = «Sin registro».
 */
type Col = { header: string; key: string; width: number; fmt?: "money" | "int" | "pct" | "text"; align?: "left" | "right" | "center" };
type SheetMeta = { title: string; context: string; by: Generator; generatedAt: Date; tab?: string };

const FMT = { money: '"$"#,##0', int: "#,##0", pct: "0.0%" } as const;
const BLACK = "FF121315";
const INK = "FF1D1E20";
const LIME = "FF14F77B";
const ZEBRA = "FFF4F5F7";
const LINE = "FFE3E6EC";
const MUTED = "FF7B7F86";

export const newBook = (): ExcelJS.Workbook => {
  const book = new ExcelJS.Workbook();
  book.creator = "Mi Tierrita SIG";
  book.created = new Date();
  return book;
};

const lastCol = (n: number): string => String.fromCharCode(64 + n);

/** Encabezado institucional de una hoja (filas 1–3) y configuración de impresión. */
const frame = (ws: ExcelJS.Worksheet, cols: number, meta: SheetMeta): void => {
  ws.mergeCells(1, 1, 1, cols);
  const t = ws.getCell(1, 1);
  t.value = `MI TIERRITA SIG · ${meta.title.toUpperCase()}`;
  t.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLACK } };
  t.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 26;
  ws.mergeCells(2, 1, 2, cols);
  const c = ws.getCell(2, 1);
  c.value = meta.context;
  c.font = { bold: true, size: 9.5, color: { argb: INK } };
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
  c.alignment = { indent: 1 };
  ws.mergeCells(3, 1, 3, cols);
  const g = ws.getCell(3, 1);
  g.value = `Generado por ${meta.by.name} (@${meta.by.username}) el ${stamp(meta.generatedAt)} · registrado en la auditoría`;
  g.font = { italic: true, size: 8.5, color: { argb: MUTED } };
  g.alignment = { indent: 1 };
  ws.properties.tabColor = { argb: meta.tab ?? LIME };
  ws.pageSetup = { orientation: "landscape", paperSize: 1 as unknown as ExcelJS.PaperSize, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.7, bottom: 0.7, header: 0.3, footer: 0.3 }, printTitlesRow: "4:4" };
  ws.headerFooter = { oddFooter: `&L&8Mi Tierrita SIG · ${meta.title}&R&8Página &P de &N` };
};

/** Hoja de datos: encabezado fijo, filtros, filas alternas, formato por columna y totales opcionales. */
export const dataSheet = (book: ExcelJS.Workbook, name: string, meta: SheetMeta, cols: Col[], rows: Record<string, unknown>[], totals?: Record<string, unknown>): ExcelJS.Worksheet => {
  const ws = book.addWorksheet(name, { views: [{ state: "frozen", ySplit: 4 }] });
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
  frame(ws, cols.length, meta);
  const head = ws.getRow(4);
  head.height = 20;
  cols.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: LIME }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
    cell.alignment = { vertical: "middle", horizontal: c.align ?? (c.fmt && c.fmt !== "text" ? "right" : "left"), indent: 0 };
  });
  rows.forEach((r, ri) => {
    const row = ws.addRow(r);
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      if (c.fmt && c.fmt !== "text" && typeof cell.value === "number") cell.numFmt = FMT[c.fmt];
      cell.alignment = { horizontal: c.align ?? (c.fmt && c.fmt !== "text" ? "right" : "left"), vertical: "middle" };
      if (typeof cell.value === "string" && (cell.value === ND || cell.value === NA || cell.value === SR)) cell.font = { color: { argb: MUTED } };
      cell.border = { bottom: { style: "hair", color: { argb: LINE } } };
      if (ri % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    });
  });
  if (totals) {
    const first = 5;
    const last = 4 + rows.length;
    const row = ws.addRow({});
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      const v = totals[c.key];
      if (v === "SUM" && rows.length > 0) {
        const sum = rows.reduce((s, r) => s + (typeof r[c.key] === "number" ? (r[c.key] as number) : 0), 0);
        cell.value = { formula: `SUM(${lastCol(i + 1)}${first}:${lastCol(i + 1)}${last})`, result: sum };
      } else cell.value = v === "SUM" ? 0 : (v as ExcelJS.CellValue) ?? null;
      if (c.fmt && c.fmt !== "text" && typeof cell.value !== "string") cell.numFmt = FMT[c.fmt];
      cell.font = { bold: true };
      cell.alignment = { horizontal: c.align ?? (c.fmt && c.fmt !== "text" ? "right" : "left") };
      cell.border = { top: { style: "medium", color: { argb: INK } } };
    });
  }
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: cols.length } };
  return ws;
};

type Indicator = { label: string; value: string | number | null; fmt?: "money" | "int" | "pct" | "text"; note?: string };

/** Hoja «Resumen»: indicadores con su unidad y el criterio de cálculo; los nulos salen como N/D. */
const summarySheet = (book: ExcelJS.Workbook, meta: SheetMeta, indicators: Indicator[], criteria: string[]): void => {
  const rows = indicators.map((i) => ({ k: i.label, v: i.value === null ? ND : i.value, n: i.note ?? "" }));
  const ws = dataSheet(book, "Resumen", meta, [{ header: "Indicador", key: "k", width: 36 }, { header: "Valor", key: "v", width: 22, align: "right" }, { header: "Cómo se calcula", key: "n", width: 60 }], rows);
  indicators.forEach((ind, i) => {
    const cell = ws.getRow(5 + i).getCell(2);
    if (typeof ind.value === "number" && ind.fmt && ind.fmt !== "text") cell.numFmt = FMT[ind.fmt];
  });
  let r = 5 + indicators.length + 1;
  ws.mergeCells(r, 1, r, 3);
  ws.getCell(r, 1).value = "CRITERIOS DE CÁLCULO";
  ws.getCell(r, 1).font = { bold: true, size: 9, color: { argb: MUTED } };
  r += 1;
  criteria.forEach((c) => {
    ws.mergeCells(r, 1, r, 3);
    ws.getCell(r, 1).value = `• ${c}`;
    ws.getCell(r, 1).font = { size: 9, color: { argb: INK } };
    ws.getCell(r, 1).alignment = { wrapText: true, vertical: "top" };
    ws.getRow(r).height = c.length > 110 ? 26 : 15;
    r += 1;
  });
};

const share = (a: number, b: number): number | null => (b > 0 ? a / b : null);

// ------------------------------------------------------------------ Ventas

export const buildSalesBook = (inp: SalesPdfInput, by: Generator, generatedAt = new Date()): ExcelJS.Workbook => {
  const { report: r, byDay, byProduct } = inp;
  const period = `Periodo ${dateShort(r.from)} – ${dateShort(r.to)} · ventas no anuladas`;
  const book = newBook();
  const m = (title: string): SheetMeta => ({ title, context: period, by, generatedAt });
  summarySheet(book, m("Reporte de ventas"), [
    { label: "Periodo", value: `${dateShort(r.from)} a ${dateShort(r.to)}`, fmt: "text" },
    { label: "Ventas (documentos)", value: r.salesCount, fmt: "int", note: "Ventas completadas, sin anuladas" },
    { label: "Unidades", value: r.units, fmt: "int", note: "Suma de cantidades vendidas" },
    { label: "Total vendido (COP)", value: r.total, fmt: "money", note: "Suma de los totales de línea" },
    { label: "De contado (COP)", value: r.cashTotal, fmt: "money" },
    { label: "A crédito (COP)", value: r.creditTotal, fmt: "money", note: "Pasa a cartera" },
    { label: "Ticket promedio (COP)", value: r.salesCount > 0 ? r.total / r.salesCount : null, fmt: "money", note: "Total vendido ÷ número de ventas; N/D si no hay ventas" },
    { label: "% a crédito", value: share(r.creditTotal, r.total), fmt: "pct", note: "A crédito ÷ total vendido" },
  ], ["Solo ventas completadas; fechas del periodo inclusive.", "N/D = dato no disponible; N/A = no aplica."]);
  dataSheet(book, "Por día", m("Ventas por día"), [{ header: "Fecha", key: "date", width: 14 }, { header: "Ventas", key: "salesCount", width: 10, fmt: "int" }, { header: "Unidades", key: "units", width: 11, fmt: "int" }, { header: "Total", key: "total", width: 16, fmt: "money" }, { header: "% del total", key: "share", width: 12, fmt: "pct" }], byDay.map((d: SalesReportByDayRow) => ({ ...d, share: share(d.total, r.total) ?? ND })), { date: "Total del periodo", salesCount: "SUM", units: "SUM", total: "SUM" });
  dataSheet(book, "Por producto", m("Ventas por producto"), [{ header: "SKU", key: "sku", width: 12 }, { header: "Producto", key: "productName", width: 44 }, { header: "Ventas", key: "salesCount", width: 10, fmt: "int" }, { header: "Unidades", key: "units", width: 11, fmt: "int" }, { header: "Total", key: "total", width: 16, fmt: "money" }, { header: "% del total", key: "share", width: 12, fmt: "pct" }], byProduct.map((p: SalesReportByProductRow) => ({ ...p, share: share(p.total, r.total) ?? ND })), { productName: "Total del periodo", salesCount: NA, units: "SUM", total: "SUM" });
  return book;
};

// ------------------------------------------------------------------ Inventario

export const buildInventoryBook = (r: InventoryReport, by: Generator, generatedAt = new Date()): ExcelJS.Workbook => {
  const days = r.expiringDays;
  const context = `Corte al ${dateShort(r.asOf)} · vencimientos a ${days} días`;
  const book = newBook();
  const m = (title: string): SheetMeta => ({ title, context, by, generatedAt });
  summarySheet(book, m("Reporte de inventario"), [
    { label: "Corte", value: dateShort(r.asOf), fmt: "text" },
    { label: "Productos registrados", value: r.products, fmt: "int" },
    { label: "Productos activos", value: r.activeProducts, fmt: "int" },
    { label: "Unidades en existencia", value: r.units, fmt: "int" },
    { label: "Valor al costo (COP)", value: r.costValue, fmt: "money", note: "Unidades restantes de cada lote × costo unitario del lote" },
    { label: "Valor a precio de venta (COP)", value: r.saleValue, fmt: "money", note: "Existencia × precio de venta vigente" },
    { label: "Agotados", value: r.outOfStock, fmt: "int", note: "Productos activos con existencia 0" },
    { label: `Lotes por vencer (${days} días)`, value: r.expiringSoon.batches, fmt: "int" },
    { label: "Costo por vencer (COP)", value: r.expiringSoon.costValue, fmt: "money" },
    { label: "Lotes vencidos", value: r.expired.batches, fmt: "int", note: "Vencimiento anterior al corte, con existencia" },
    { label: "Costo vencido (COP)", value: r.expired.costValue, fmt: "money" },
  ], ["Las ventas descuentan primero el lote que vence antes (FEFO).", "El valor a precio de venta usa otra base que el costo; su diferencia no es utilidad realizada."]);
  const total = r.byCategory.reduce((s, c) => s + c.costValue, 0);
  dataSheet(book, "Por línea", m("Inventario por línea"), [{ header: "Línea", key: "categoryName", width: 30 }, { header: "Productos", key: "products", width: 11, fmt: "int" }, { header: "Unidades", key: "units", width: 11, fmt: "int" }, { header: "Valor al costo", key: "costValue", width: 18, fmt: "money" }, { header: "Valor a precio de venta", key: "saleValue", width: 22, fmt: "money" }, { header: "% del costo", key: "share", width: 12, fmt: "pct" }], r.byCategory.map((c) => ({ ...c, share: share(c.costValue, total) ?? ND })), { categoryName: "Total por línea", products: "SUM", units: "SUM", costValue: "SUM", saleValue: "SUM" });
  return book;
};

// ------------------------------------------------------------------ Cartera

export const buildReceivablesBook = (r: ReceivablesReport, by: Generator, today: string, generatedAt = new Date()): ExcelJS.Workbook => {
  const context = `Corte al ${dateShort(today)} · vencida a más de ${r.overdueDays} días`;
  const book = newBook();
  const m = (title: string): SheetMeta => ({ title, context, by, generatedAt });
  const withLimit = r.items.filter((i) => i.creditLimit > 0);
  summarySheet(book, m("Reporte de cartera"), [
    { label: "Corte", value: dateShort(today), fmt: "text" },
    { label: "Clientes con saldo", value: r.customersWithBalance, fmt: "int" },
    { label: "Cartera total (COP)", value: r.totalBalance, fmt: "money" },
    { label: "Cartera vencida (COP)", value: r.overdueBalance, fmt: "money", note: `Clientes con última venta a crédito de más de ${r.overdueDays} días` },
    { label: "Clientes vencidos", value: r.overdueCustomers, fmt: "int" },
    { label: "Cartera al día (COP)", value: r.totalBalance - r.overdueBalance, fmt: "money", note: "Cartera total − vencida" },
    { label: "% vencida", value: share(r.overdueBalance, r.totalBalance), fmt: "pct", note: "Vencida ÷ cartera total; N/D si no hay cartera" },
    { label: "Uso del cupo", value: share(withLimit.reduce((s, i) => s + i.balance, 0), withLimit.reduce((s, i) => s + i.creditLimit, 0)), fmt: "pct", note: "Saldo ÷ cupo, solo clientes con cupo asignado" },
  ], ["«Sin registro» indica que el cliente no tiene ese evento en el sistema.", "N/D = dato no disponible; N/A = no aplica (por ejemplo, uso del cupo sin cupo asignado)."]);
  const rows = r.items.map((i) => ({
    name: i.name,
    creditLimit: i.creditLimit,
    balance: i.balance,
    use: i.creditLimit > 0 ? i.balance / i.creditLimit : NA,
    lastCreditSaleAt: i.lastCreditSaleAt ? i.lastCreditSaleAt.slice(0, 10) : SR,
    lastPaymentAt: i.lastPaymentAt ? i.lastPaymentAt.slice(0, 10) : SR,
    overdue: i.overdue ? "Vencida" : "Al día",
  }));
  const ws = dataSheet(book, "Cartera", m("Reporte de cartera"), [{ header: "Cliente", key: "name", width: 34 }, { header: "Cupo", key: "creditLimit", width: 15, fmt: "money" }, { header: "Saldo", key: "balance", width: 15, fmt: "money" }, { header: "Uso del cupo", key: "use", width: 13, fmt: "pct" }, { header: "Última venta a crédito", key: "lastCreditSaleAt", width: 22, align: "center" }, { header: "Último abono", key: "lastPaymentAt", width: 16, align: "center" }, { header: "Estado", key: "overdue", width: 12, align: "center" }], rows, { name: "Total", creditLimit: "SUM", balance: "SUM" });
  rows.forEach((x, i) => {
    const cell = ws.getRow(5 + i).getCell(7);
    cell.font = { bold: true, color: { argb: x.overdue === "Vencida" ? "FF9B2C22" : "FF1F5F2D" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: x.overdue === "Vencida" ? "FFF8E0DD" : "FFE3F1E5" } };
  });
  return book;
};

// ------------------------------------------------------------------ Escenario

export const buildScenarioBook = (s: ScenarioPdfInput, by: Generator, generatedAt = new Date()): ExcelJS.Workbook => {
  const res = s.results;
  const context = `Escenario «${s.name}» · horizonte de ${Math.max(0, res.flows.length - 1)} años`;
  const book = newBook();
  const m = (title: string): SheetMeta => ({ title, context, by, generatedAt });
  summarySheet(book, m(`Escenario · ${s.name}`), [
    { label: "Inversión total (COP)", value: res.totalInvestment, fmt: "money" },
    { label: "Crédito (COP)", value: res.credit, fmt: "money" },
    { label: "Cuota mensual (COP)", value: res.installment, fmt: "money" },
    { label: "VPN (COP)", value: res.npv, fmt: "money", note: "Valor presente neto del flujo del proyecto" },
    { label: "TIR", value: res.irr, fmt: "pct", note: "N/D si el motor no la calcula" },
    { label: "Recuperación simple (años)", value: res.paybackSimple, fmt: "text", note: "Sin descontar; N/D si no se calcula" },
    { label: "Relación B/C", value: res.benefitCostRatio, fmt: "text" },
    { label: "Cobertura incremental de la cuota (x)", value: res.coverageIncremental, fmt: "text", note: "Flujo adicional de la ampliación ÷ cuota; N/D si no se calcula" },
  ], ["Cifras del motor financiero con supuestos académicos por validar.", "La decisión es de la gerencia."]);
  let acc = 0;
  dataSheet(book, "Flujo", m("Flujo de caja del proyecto"), [{ header: "Año", key: "year", width: 8 }, { header: "Flujo neto", key: "flow", width: 18, fmt: "money" }, { header: "Flujo acumulado", key: "acc", width: 18, fmt: "money" }], res.flows.map((flow, year) => { acc += flow; return { year, flow, acc }; }), { year: "Suma", flow: "SUM", acc: NA });
  dataSheet(book, "Tornado", m("Sensibilidad del VPN (±20 %)"), [{ header: "Variable", key: "v", width: 28 }, { header: "VPN con −20 %", key: "lo", width: 18, fmt: "money" }, { header: "VPN con +20 %", key: "hi", width: 18, fmt: "money" }, { header: "Amplitud", key: "amp", width: 16, fmt: "money" }], s.tornado.map((b) => ({ v: b.label, lo: b.npvLow, hi: b.npvHigh, amp: Math.abs(b.npvHigh - b.npvLow) })));
  return book;
};
