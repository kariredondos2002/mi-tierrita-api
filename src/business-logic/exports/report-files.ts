import type ExcelJS from "exceljs";
import { salesReport, inventoryReport, receivablesReport, type SalesReportByDayRow, type SalesReportByProductRow } from "../reports/index";
import { getScenario, getScenarioTornado } from "../financial/index";
import type { Generator } from "./pdf-theme";
import { buildInventoryPdf, buildReceivablesPdf, buildSalesPdf, buildScenarioPdf, type ScenarioPdfInput } from "./report-pdf";
import { buildInventoryBook, buildReceivablesBook, buildSalesBook, buildScenarioBook } from "./report-xlsx";

/**
 * Archivos de reportes (v4.2, rediseñados en v4.4): cada reporte gerencial se descarga como PDF o
 * como Excel. Aquí solo se consultan los datos (las mismas consultas de /reports) y se entregan al
 * generador del formato; el diseño vive en `pdf-theme` / `report-pdf` / `report-xlsx`.
 */
export type ExportFormat = "pdf" | "xlsx";
export type ExportFile = { filename: string; contentType: string; body: Buffer; description: string };

const CT = { pdf: "application/pdf", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } as const;

const xlsxFile = async (book: ExcelJS.Workbook, filename: string, description: string): Promise<ExportFile> => ({
  filename,
  contentType: CT.xlsx,
  body: Buffer.from(await book.xlsx.writeBuffer()),
  description,
});

const pdfFile = (body: Buffer, filename: string, description: string): ExportFile => ({ filename, contentType: CT.pdf, body, description });

// ---------------------------------------------------------------- Ventas

export const exportSales = async (from: string, to: string, groupBy: "day" | "product", format: ExportFormat, by: Generator): Promise<ExportFile> => {
  const r = await salesReport(from, to, groupBy);
  const label = `Reporte de ventas · ${format.toUpperCase()} · ${from} a ${to} · ${groupBy === "day" ? "por día" : "por producto"}`;
  const base = `ventas_${from}_${to}_${groupBy === "day" ? "por-dia" : "por-producto"}`;
  // los dos desgloses siempre van: el de producto alimenta el ranking y el de día, la evolución
  const byProduct = groupBy === "product" ? (r.rows as SalesReportByProductRow[]) : ((await salesReport(from, to, "product")).rows as SalesReportByProductRow[]);
  const byDay = groupBy === "day" ? (r.rows as SalesReportByDayRow[]) : ((await salesReport(from, to, "day")).rows as SalesReportByDayRow[]);
  const input = { report: r, byDay, byProduct, groupBy };
  if (format === "xlsx") return xlsxFile(buildSalesBook(input, by), `${base}.xlsx`, label);
  return pdfFile(await buildSalesPdf(input, by), `${base}.pdf`, label);
};

// ---------------------------------------------------------------- Inventario

export const exportInventory = async (days: number, format: ExportFormat, by: Generator): Promise<ExportFile> => {
  const r = await inventoryReport(days);
  const label = `Reporte de inventario · ${format.toUpperCase()} · corte ${r.asOf} · vencimientos a ${days} días`;
  const base = `inventario_${r.asOf}_${days}-dias`;
  if (format === "xlsx") return xlsxFile(buildInventoryBook(r, by), `${base}.xlsx`, label);
  return pdfFile(await buildInventoryPdf(r, by), `${base}.pdf`, label);
};

// ---------------------------------------------------------------- Cartera

export const exportReceivables = async (overdueDays: number, format: ExportFormat, by: Generator): Promise<ExportFile> => {
  const r = await receivablesReport(overdueDays);
  const today = new Date().toISOString().slice(0, 10);
  const label = `Reporte de cartera · ${format.toUpperCase()} · vencida a ${overdueDays} días`;
  const base = `cartera_${today}_${overdueDays}-dias`;
  if (format === "xlsx") return xlsxFile(buildReceivablesBook(r, by, today), `${base}.xlsx`, label);
  return pdfFile(await buildReceivablesPdf(r, by, today), `${base}.pdf`, label);
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
  const input: ScenarioPdfInput = {
    name: s.name,
    results: s.results as unknown as ScenarioPdfInput["results"],
    tornado: t.bars.map((b) => ({ variable: b.variable, label: TORNADO_LABEL[b.variable] ?? b.variable, npvLow: b.npvLow, npvHigh: b.npvHigh })),
  };
  const label = `Escenario financiero · ${format.toUpperCase()} · ${s.name}`;
  const base = `escenario-${id}`;
  if (format === "xlsx") return xlsxFile(buildScenarioBook(input, by), `${base}.xlsx`, label);
  return pdfFile(await buildScenarioPdf(input, by), `${base}.pdf`, label);
};
