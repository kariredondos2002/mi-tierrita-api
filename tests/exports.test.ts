import { test } from "node:test";
import assert from "node:assert/strict";
import { barChart, composeBlocks, createPdf, donut, emptyState, finish, findings, fitText, header, hbarChart, kpis, lineChart, money, moneyShort, NA, ND, orND, pct, ratio, runBlocks, sectionTitle, summaryBox, table } from "../src/business-logic/exports/pdf-theme";

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

/** v4.4: integridad de datos y plantilla común. */
test("cero, no disponible y no aplica se distinguen", () => {
  assert.equal(pct(null), ND);
  assert.match(pct(0), /^0 %$/);
  assert.equal(ratio(null), ND);
  assert.equal(orND(null, money), ND);
  assert.equal(orND(0, money), "$ 0");
  assert.notEqual(ND, NA);
});

test("los bloques se pueden ocultar, reordenar y omitir según los datos", () => {
  const seen: string[] = [];
  const mk = (id: string, when?: boolean) => ({ id, when, render: () => void seen.push(id) });
  const blocks = [mk("a"), mk("b", false), mk("c"), mk("d")];
  assert.deepEqual(composeBlocks(blocks).map((b) => b.id), ["a", "c", "d"]);
  assert.deepEqual(composeBlocks(blocks, { hide: ["c"] }).map((b) => b.id), ["a", "d"]);
  assert.deepEqual(composeBlocks(blocks, { order: ["d", "a"] }).map((b) => b.id), ["d", "a", "c"]);
  runBlocks(blocks, { order: ["c"] });
  assert.deepEqual(seen, ["c", "a", "d"]);
});

test("PDF con estados vacíos, negativos, hallazgos, totales y etiquetas", async () => {
  const { doc, done } = createPdf("Vacío");
  header(doc, "Reporte", "Sub", { name: "Ana", username: "ana" }, new Date("2026-10-09T15:00:00Z"), { period: "01/09/2026 – 30/09/2026", context: "Prueba" });
  summaryBox(doc, ["Una línea de resumen.", "Otra línea."]);
  kpis(doc, [{ label: "Sin dato", value: ND }, { label: "Cero", value: money(0) }, { label: "No aplica", value: NA }]);
  barChart(doc, [], { title: "Sin datos" });
  barChart(doc, [{ label: "A0", value: -50 }, { label: "A1", value: 20 }, { label: "A2", value: 35 }], { title: "Con negativo" });
  lineChart(doc, [{ label: "1", value: -5 }, { label: "2", value: 4 }]);
  hbarChart(doc, [{ label: "x", value: 0 }]);
  donut(doc, [{ label: "x", value: 0 }]);
  findings(doc, []);
  findings(doc, [{ tone: "warn", title: "Título", text: "Texto de apoyo con cifras." }]);
  emptyState(doc, "Nada", "pista");
  table(doc, [{ title: "A", width: 1 }, { title: "B", width: 1, align: "right" }], [], { empty: "Sin filas" });
  table(doc, [{ title: "A", width: 1 }, { title: "Estado", width: 1, align: "center" }], Array.from({ length: 120 }, (_, i) => [`F${i}`, i % 2 ? "Vencida" : "Al día"]), { totals: ["Total", NA], tag: (r, c) => (c === 1 ? (r[1] === "Vencida" ? "bad" : "good") : undefined) });
  finish(doc, "Vacío");
  const pdf = await done;
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  // más de una página: el encabezado de la tabla se repite y el pie numera «Página X de Y»
  assert.ok(pdf.toString("latin1").match(/\/Type \/Page\b/g)!.length >= 3);
});
