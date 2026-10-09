import PDFDocument from "pdfkit";

/**
 * Plantilla PDF «Campo abierto» para los reportes gerenciales (adaptada de los reportes PDF de
 * SoftUnity): banda negra con acento lima, quién lo generó y cuándo, tarjetas de indicadores,
 * gráficos vectoriales y tablas con filas alternas. Fuentes estándar (Helvetica), sin archivos extra.
 */
export const C = {
  black: "#121315",
  ink: "#1D1E20",
  ink2: "#4A4D52",
  muted: "#7B7F86",
  line: "#E3E6EC",
  zebra: "#F4F5F7",
  lime: "#14F77B",
  olive: "#2F3A13",
  green: "#2F7A3E",
  harvest: "#E3A33B",
  bad: "#C23B2E",
  sky: "#3A7CA5",
  chart: ["#2F7A3E", "#E3A33B", "#3A7CA5", "#C0612B", "#2F3A13", "#8AA65A"],
} as const;

export type Doc = PDFKit.PDFDocument;
export type Generator = { name: string; username: string };

const money0 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
export const money = (n: number): string => `$ ${money0.format(Math.round(n))}`;
export const moneyShort = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$ ${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(n / 1_000_000)} M`;
  if (a >= 1_000) return `$ ${money0.format(n / 1_000)} mil`;
  return money(n);
};
export const int = (n: number): string => money0.format(n);
export const pct = (n: number | null): string => (n === null ? "—" : `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(n * 100)} %`);
export const stamp = (d = new Date()): string =>
  d.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "long", timeStyle: "short" });

const M = 48; // margen

/** Crea el documento y devuelve una promesa con el Buffer al terminar. */
export const createPdf = (title: string): { doc: Doc; done: Promise<Buffer> } => {
  const doc = new PDFDocument({ size: "LETTER", margin: M, bufferPages: true, info: { Title: title, Author: "Mi Tierrita SIG", Creator: "Mi Tierrita SIG" } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  return { doc, done };
};

export const contentWidth = (doc: Doc): number => doc.page.width - M * 2;

/** Encabezado: banda negra, marca, título del reporte, subtítulo y quién/cuándo lo generó. */
export const header = (doc: Doc, title: string, subtitle: string, by: Generator, generatedAt: Date): void => {
  const w = doc.page.width;
  doc.save().rect(0, 0, w, 92).fill(C.black).restore();
  doc.save().rect(0, 92, w, 4).fill(C.lime).restore();
  doc.save().roundedRect(M, 26, 30, 30, 6).fill(C.lime).restore();
  doc.save().moveTo(M + 15, 50).lineTo(M + 15, 36).lineWidth(2.4).strokeColor(C.black).stroke().restore();
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9).text("MI TIERRITA SIG · AGROPECUARIA · SAHAGÚN, CÓRDOBA", M + 42, 28, { characterSpacing: 1.2 });
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(20).text(title.toUpperCase(), M + 42, 42, { characterSpacing: 0.5 });
  doc.fillColor(C.ink2).font("Helvetica").fontSize(10).text(subtitle, M, 110, { width: contentWidth(doc) });
  doc.fillColor(C.muted).fontSize(8.5).text(`Generado por ${by.name} (@${by.username}) el ${stamp(generatedAt)} · queda registrado en la auditoría`, M, doc.y + 3, { width: contentWidth(doc) });
  doc.moveDown(1.2);
};

/** Título de sección; reserva espacio para que no quede solo al final de la página. */
export const sectionTitle = (doc: Doc, text: string, keepWith = 140): void => {
  ensureSpace(doc, keepWith);
  const y = doc.y + 4;
  doc.save().rect(M, y + 2, 4, 14).fill(C.lime).restore();
  doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(12.5).text(text.toUpperCase(), M + 12, y + 2, { characterSpacing: 0.4 });
  doc.moveDown(0.6);
};

export const ensureSpace = (doc: Doc, h: number): void => {
  if (doc.y + h > doc.page.height - M - 30) doc.addPage();
};

/** Fila de tarjetas de indicadores. tone: neutral | good | warn | bad. */
export const kpis = (doc: Doc, items: { label: string; value: string; hint?: string; tone?: "neutral" | "good" | "warn" | "bad" }[]): void => {
  ensureSpace(doc, 70);
  const gap = 10;
  const w = (contentWidth(doc) - gap * (items.length - 1)) / items.length;
  const y = doc.y;
  const toneColor = { neutral: C.olive, good: C.green, warn: C.harvest, bad: C.bad };
  items.forEach((k, i) => {
    const x = M + i * (w + gap);
    doc.save().roundedRect(x, y, w, 58, 6).lineWidth(0.8).strokeColor(C.line).stroke().restore();
    doc.save().rect(x, y + 8, 3, 42).fill(toneColor[k.tone ?? "neutral"]).restore();
    doc.fillColor(C.muted).font("Helvetica").fontSize(8).text(k.label, x + 11, y + 9, { width: w - 18 });
    doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(14).text(k.value, x + 11, y + 22, { width: w - 18 });
    if (k.hint) doc.fillColor(C.muted).font("Helvetica").fontSize(7.5).text(k.hint, x + 11, y + 42, { width: w - 18 });
  });
  doc.x = M;
  doc.y = y + 70;
};

/** Barras verticales con eje, etiquetas y valor sobre las barras (máx. ~31 barras). */
export const barChart = (doc: Doc, data: { label: string; value: number }[], opts: { height?: number; format?: (n: number) => string; color?: string } = {}): void => {
  const height = opts.height ?? 150;
  ensureSpace(doc, height + 40);
  const width = contentWidth(doc);
  const top = doc.y + 6;
  const baseY = top + height;
  const left = M + 46;
  const plotW = width - 46;
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = opts.format ?? moneyShort;
  // rejilla
  doc.font("Helvetica").fontSize(7).fillColor(C.muted);
  for (let i = 0; i <= 4; i++) {
    const y = baseY - (height * i) / 4;
    doc.save().moveTo(left, y).lineTo(M + width, y).lineWidth(0.5).strokeColor(C.line).stroke().restore();
    doc.text(fmt((max * i) / 4), M, y - 4, { width: 42, align: "right" });
  }
  const slot = plotW / Math.max(1, data.length);
  const bw = Math.min(28, slot * 0.68);
  data.forEach((d, i) => {
    const h = (d.value / max) * height;
    const x = left + i * slot + (slot - bw) / 2;
    doc.save().rect(x, baseY - h, bw, h).fill(opts.color ?? C.green).restore();
    if (data.length <= 14) doc.fillColor(C.ink2).fontSize(6.5).text(fmt(d.value), x - 12, baseY - h - 9, { width: bw + 24, align: "center" });
    const showLabel = data.length <= 16 || i % Math.ceil(data.length / 12) === 0;
    if (showLabel) doc.fillColor(C.muted).fontSize(6.5).text(d.label, left + i * slot - 6, baseY + 4, { width: slot + 12, align: "center" });
  });
  doc.x = M;
  doc.y = baseY + 20;
};

/** Barras horizontales (ranking): etiqueta a la izquierda, barra y valor. */
/** Recorta un texto con «…» para que quepa en una línea del ancho dado (fuente actual). */
export const fitText = (doc: Doc, text: string, width: number): string => {
  if (doc.widthOfString(text) <= width) return text;
  let t = text;
  while (t.length > 1 && doc.widthOfString(`${t}…`) > width) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
};

export const hbarChart = (doc: Doc, data: { label: string; value: number; color?: string }[], opts: { format?: (n: number) => string } = {}): void => {
  const rowH = 17;
  ensureSpace(doc, data.length * rowH + 16);
  const width = contentWidth(doc);
  const labelW = 170;
  const barMax = width - labelW - 80;
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = opts.format ?? moneyShort;
  let y = doc.y + 4;
  data.forEach((d, i) => {
    doc.fillColor(C.ink).font("Helvetica").fontSize(8.5).text(fitText(doc, d.label, labelW - 10), M, y + 3, { width: labelW - 8, lineBreak: false });
    doc.save().roundedRect(M + labelW, y + 3, barMax, 9, 4).fill(C.zebra).restore();
    doc.save().roundedRect(M + labelW, y + 3, Math.max(2, (d.value / max) * barMax), 9, 4).fill(d.color ?? C.chart[i % C.chart.length]).restore();
    doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(8.5).text(fmt(d.value), M + labelW + barMax + 6, y + 3, { width: 74, align: "right" });
    y += rowH;
  });
  doc.x = M;
  doc.y = y + 8;
};

/** Dona con leyenda a la derecha. */
export const donut = (doc: Doc, data: { label: string; value: number }[], opts: { format?: (n: number) => string } = {}): void => {
  const r = 52;
  ensureSpace(doc, r * 2 + 20);
  const cx = M + r + 6;
  const cy = doc.y + r + 6;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let a0 = -Math.PI / 2;
  data.forEach((d, i) => {
    const a1 = a0 + (d.value / total) * Math.PI * 2;
    if (d.value > 0) {
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
      const p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
      doc.save().path(`M ${cx} ${cy} L ${p0[0]} ${p0[1]} A ${r} ${r} 0 ${large} 1 ${p1[0]} ${p1[1]} Z`).fill(C.chart[i % C.chart.length]).restore();
    }
    a0 = a1;
  });
  doc.save().circle(cx, cy, r * 0.58).fill("#FFFFFF").restore();
  const fmt = opts.format ?? moneyShort;
  let ly = cy - r + 4;
  data.forEach((d, i) => {
    doc.save().rect(cx + r + 24, ly + 2, 9, 9).fill(C.chart[i % C.chart.length]).restore();
    doc.fillColor(C.ink).font("Helvetica").fontSize(8.5).text(`${d.label}  ·  ${fmt(d.value)}  (${Math.round((d.value / total) * 100)} %)`, cx + r + 40, ly + 2, { width: contentWidth(doc) - r * 2 - 60 });
    ly += 15;
  });
  doc.x = M;
  doc.y = Math.max(cy + r + 14, ly + 6);
};

/** Tabla con encabezado negro y filas alternas; repite el encabezado en cada página. */
export const table = (doc: Doc, cols: { title: string; width: number; align?: "left" | "right" }[], rows: string[][]): void => {
  const width = contentWidth(doc);
  const total = cols.reduce((s, c) => s + c.width, 0);
  const ws = cols.map((c) => (c.width / total) * width);
  const drawHead = () => {
    const y = doc.y;
    doc.save().rect(M, y, width, 17).fill(C.ink).restore();
    let x = M;
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(7.8);
    cols.forEach((c, i) => {
      doc.text(c.title, x + 5, y + 5, { width: ws[i]! - 10, align: c.align ?? "left", lineBreak: false });
      x += ws[i]!;
    });
    doc.y = y + 19;
  };
  ensureSpace(doc, 19 + Math.min(rows.length, 4) * 15);
  drawHead();
  rows.forEach((r, ri) => {
    if (doc.y + 16 > doc.page.height - M - 30) {
      doc.addPage();
      drawHead();
    }
    const y = doc.y;
    if (ri % 2 === 1) doc.save().rect(M, y - 1, width, 15).fill(C.zebra).restore();
    let x = M;
    doc.fillColor(C.ink).font("Helvetica").fontSize(8);
    r.forEach((cell, i) => {
      doc.text(fitText(doc, cell, ws[i]! - 10), x + 5, y + 2, { width: ws[i]! - 10, align: cols[i]!.align ?? "left", lineBreak: false });
      x += ws[i]!;
    });
    doc.y = y + 15;
  });
  doc.x = M;
  doc.moveDown(0.6);
};

export const note = (doc: Doc, text: string): void => {
  ensureSpace(doc, 14);
  doc.fillColor(C.muted).font("Helvetica-Oblique").fontSize(8).text(text, M, doc.y, { width: contentWidth(doc) });
  doc.moveDown(0.5);
};

/** Pie en todas las páginas: créditos y «página n de N». */
export const finish = (doc: Doc, reportName: string): void => {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // escribir el pie sin que pdfkit agregue una página
    const y = doc.page.height - M + 8;
    doc.save().moveTo(M, y - 6).lineTo(doc.page.width - M, y - 6).lineWidth(0.5).strokeColor(C.line).stroke().restore();
    doc.fillColor(C.muted).font("Helvetica").fontSize(7.5);
    doc.text(`Mi Tierrita SIG · ${reportName} · datos de demostración simulados`, M, y, { width: 360, lineBreak: false });
    doc.text(`Página ${i - range.start + 1} de ${range.count}`, doc.page.width - M - 120, y, { width: 120, align: "right", lineBreak: false });
  }
  doc.end();
};
