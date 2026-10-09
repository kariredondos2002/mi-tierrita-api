import { test } from "node:test";
import assert from "node:assert/strict";
import { barChart, createPdf, donut, finish, fitText, header, hbarChart, kpis, money, moneyShort, sectionTitle, table } from "../src/business-logic/exports/pdf-theme";

/** v4.2: el tema de los PDF produce un documento válido con encabezado, gráficos, tabla y pie. */
test("createPdf arma un PDF válido con gráficos y varias páginas", async () => {
  const { doc, done } = createPdf("Prueba");
  header(doc, "Reporte de prueba", "Subtítulo", { name: "Karina Redondo", username: "karina" }, new Date("2026-10-09T15:00:00Z"));
  kpis(doc, [{ label: "Total", value: money(1500000) }, { label: "Vencido", value: money(0), tone: "bad" }]);
  sectionTitle(doc, "Barras");
  barChart(doc, [{ label: "L", value: 10 }, { label: "M", value: 20 }]);
  sectionTitle(doc, "Barras horizontales");
  hbarChart(doc, [{ label: "Una etiqueta muy larga que no cabe en la columna de nombres", value: 5 }]);
  donut(doc, [{ label: "Contado", value: 3 }, { label: "Crédito", value: 1 }]);
  table(doc, [{ title: "Fila", width: 1 }, { title: "Valor", width: 1, align: "right" }], Array.from({ length: 80 }, (_, i) => [`#${i}`, money(i * 1000)]));
  finish(doc, "Prueba");
  const pdf = await done;
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdf.length > 3000);
});

test("formatos de dinero y recorte de texto", () => {
  assert.match(money(1234567), /1\.234\.567/);
  assert.match(moneyShort(2_500_000), /2,5 M/);
  const { doc } = createPdf("x");
  doc.font("Helvetica").fontSize(8.5);
  const cut = fitText(doc, "x".repeat(200), 60);
  assert.ok(cut.endsWith("…"));
  assert.ok(doc.widthOfString(cut) <= 60);
  assert.equal(fitText(doc, "corto", 60), "corto");
  doc.end();
});
