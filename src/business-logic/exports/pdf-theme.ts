import PDFDocument from "pdfkit";

/**
 * Plantilla PDF «Verde pastel» para los reportes gerenciales (v4.4).
 *
 * Es la única fuente de estilo y de componentes de los PDF: encabezado institucional con franja de
 * metadatos, resumen ejecutivo, tarjetas de indicadores, gráficos vectoriales (barras, barras
 * horizontales, dona, línea), tablas con encabezado repetido y totales, hallazgos, estados vacíos,
 * criterios de cálculo y pie «Página X de Y». Fuentes estándar (Helvetica), sin archivos extra y con
 * texto seleccionable. Los reportes arman su contenido como una lista de bloques (`runBlocks`) que se
 * pueden ocultar o reordenar sin tocar el estilo.
 *
 * Integridad de datos: este módulo nunca inventa valores. Distingue tres casos en pantalla:
 * cero real («0» o «$ 0»), dato no disponible («N/D») y campo que no aplica («N/A»).
 */
export const C = {
  black: "#1D6B3E",
  ink: "#1C2420",
  ink2: "#4B5650",
  muted: "#7A847E",
  line: "#E1E9E4",
  zebra: "#F4F7F5",
  panel: "#F8FAF9",
  shadow: "#EAF0EC",
  lime: "#9FD3B2",
  olive: "#1D6B3E",
  green: "#2F9E5B",
  greenSoft: "#E6F4EA",
  harvest: "#E3A33B",
  bad: "#D4554F",
  sky: "#3A7CA5",
  chart: ["#2F9E5B", "#E3A33B", "#3A7CA5", "#D4554F", "#1D6B3E", "#9FD3B2"],
} as const;

export type Doc = PDFKit.PDFDocument;
export type Generator = { name: string; username: string };
export type Tone = "neutral" | "good" | "warn" | "bad";

const TONE: Record<Tone, { solid: string; bg: string; fg: string }> = {
  neutral: { solid: C.olive, bg: "#EAF0EC", fg: "#4B5650" },
  good: { solid: C.green, bg: "#E6F4EA", fg: "#175A33" },
  warn: { solid: C.harvest, bg: "#FBEFD5", fg: "#8A5A0B" },
  bad: { solid: C.bad, bg: "#FBE0DE", fg: "#A63A35" },
};

// ------------------------------------------------------------------ formatos

/** Dato no disponible (no se pudo calcular o no hay registro). No es cero. */
export const ND = "N/D";
/** Campo que no aplica a esa fila o columna. No es cero ni falta de dato. */
export const NA = "N/A";
/** Un evento que nunca ocurrió (por ejemplo, un cliente sin abonos). Tampoco es cero. */
export const SR = "Sin registro";
const isMissing = (c: string): boolean => c === ND || c === NA || c === SR;

const money0 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
export const money = (n: number): string => `$ ${money0.format(Math.round(n))}`;
export const moneyShort = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$ ${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(n / 1_000_000)} M`;
  if (a >= 1_000) return `$ ${money0.format(n / 1_000)} mil`;
  return money(n);
};
export const int = (n: number): string => money0.format(n);
export const pct = (n: number | null): string => (n === null ? ND : `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(n * 100)} %`);
export const ratio = (n: number | null, suffix = "x"): string => (n === null ? ND : `${n.toFixed(2).replace(".", ",")} ${suffix}`);
/** Aplica un formato solo si hay dato; si falta devuelve «N/D». */
export const orND = <T>(v: T | null | undefined, f: (x: T) => string): string => (v === null || v === undefined ? ND : f(v));
export const stamp = (d = new Date()): string => d.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "long", timeStyle: "short" });
/** 09/10/2026 */
export const dateShort = (iso: string): string => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
/** 9 oct 2026 */
export const dateEs = (iso: string): string => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
};

// ------------------------------------------------------------------ geometría

const M = 48; // margen lateral
const TOP = 64; // inicio del contenido en páginas de continuación
const FOOT = 68; // reserva inferior (pie + holgura): ningún bloque se dibuja por debajo
const limitY = (doc: Doc): number => doc.page.height - FOOT;

type Running = { title: string; context: string };
const running = new WeakMap<Doc, Running>();

/** Crea el documento y devuelve una promesa con el Buffer al terminar. */
export const createPdf = (title: string): { doc: Doc; done: Promise<Buffer> } => {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: TOP, bottom: 56, left: M, right: M },
    bufferPages: true,
    info: { Title: title, Author: "Mi Tierrita SIG", Creator: "Mi Tierrita SIG", Subject: "Reporte gerencial" },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  return { doc, done };
};

export const contentWidth = (doc: Doc): number => doc.page.width - M * 2;

export const ensureSpace = (doc: Doc, h: number): void => {
  if (doc.y + h > limitY(doc)) {
    doc.addPage();
    doc.x = M;
    doc.y = TOP;
  }
};

// ------------------------------------------------------------------ encabezado

export type HeaderMeta = {
  /** Qué abarca el reporte (alcance, criterio de corte). */
  context?: string;
  /** Periodo o fecha de corte analizado. */
  period: string;
};

/** Marca vectorial (brote) sobre un cuadro lima. */
const logo = (doc: Doc, x: number, y: number, size: number): void => {
  doc.save().roundedRect(x, y, size, size, size * 0.2).fill(C.lime).restore();
  const cx = x + size / 2;
  doc.save().moveTo(cx, y + size * 0.78).lineTo(cx, y + size * 0.42).lineWidth(size * 0.08).strokeColor(C.black).stroke().restore();
  doc.save().path(`M ${cx} ${y + size * 0.46} C ${cx - size * 0.34} ${y + size * 0.46} ${cx - size * 0.34} ${y + size * 0.2} ${cx - size * 0.02} ${y + size * 0.22} C ${cx - size * 0.02} ${y + size * 0.36} ${cx - size * 0.08} ${y + size * 0.44} ${cx} ${y + size * 0.46} Z`).fill(C.black).restore();
  doc.save().path(`M ${cx} ${y + size * 0.52} C ${cx + size * 0.32} ${y + size * 0.52} ${cx + size * 0.32} ${y + size * 0.3} ${cx + size * 0.04} ${y + size * 0.3} C ${cx + size * 0.04} ${y + size * 0.42} ${cx + size * 0.08} ${y + size * 0.5} ${cx} ${y + size * 0.52} Z`).fill(C.black).restore();
};

/**
 * Encabezado institucional: banda negra con logotipo, nombre del sistema y título; descripción;
 * franja de contexto (periodo, alcance, fecha de generación, quién lo generó).
 * Con `meta` se dibuja la franja completa; sin ella, la línea simple de siempre.
 */
export const header = (doc: Doc, title: string, subtitle: string, by: Generator, generatedAt: Date, meta?: HeaderMeta): void => {
  const w = doc.page.width;
  doc.save().rect(0, 0, w, 92).fill(C.black).restore();
  doc.save().rect(0, 92, w, 4).fill(C.lime).restore();
  logo(doc, M, 24, 34);
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(8.5).text("MI TIERRITA SIG · AGROPECUARIA · SAHAGÚN, CÓRDOBA", M + 46, 27, { characterSpacing: 1.1, lineBreak: false });
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(21).text(title.toUpperCase(), M + 46, 41, { characterSpacing: 0.5, lineBreak: false });
  running.set(doc, { title, context: meta?.period ?? "" });

  doc.fillColor(C.ink2).font("Helvetica").fontSize(10).text(subtitle, M, 108, { width: contentWidth(doc) });
  if (!meta) {
    doc.fillColor(C.muted).fontSize(8.5).text(`Generado por ${by.name} (@${by.username}) el ${stamp(generatedAt)} · queda registrado en la auditoría`, M, doc.y + 3, { width: contentWidth(doc) });
    doc.moveDown(1.2);
    return;
  }
  const cells: { label: string; value: string; w: number }[] = [
    { label: "PERIODO / CORTE", value: meta.period, w: 1.45 },
    ...(meta.context ? [{ label: "ALCANCE", value: meta.context, w: 1.45 }] : []),
    { label: "GENERADO", value: generatedAt.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" }), w: 1 },
    { label: "GENERADO POR", value: `${by.name} (@${by.username})`, w: 1.2 },
  ];
  const totalW = cells.reduce((s, c) => s + c.w, 0);
  const y = doc.y + 8;
  const h = 40;
  let cx = M;
  doc.save().roundedRect(M, y, contentWidth(doc), h, 6).fill(C.panel).restore();
  doc.save().roundedRect(M, y, contentWidth(doc), h, 6).lineWidth(0.6).strokeColor(C.line).stroke().restore();
  cells.forEach((c, i) => {
    const cw = (c.w / totalW) * contentWidth(doc);
    const x = cx;
    cx += cw;
    if (i > 0) doc.save().moveTo(x, y + 8).lineTo(x, y + h - 8).lineWidth(0.5).strokeColor(C.line).stroke().restore();
    doc.fillColor(C.muted).font("Helvetica-Bold").fontSize(6.5).text(c.label, x + 10, y + 8, { width: cw - 16, characterSpacing: 0.6, lineBreak: false });
    doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(8.5).text(fitText(doc, c.value, cw - 18), x + 10, y + 20, { width: cw - 16, lineBreak: false });
  });
  doc.x = M;
  doc.y = y + h + 6;
  doc.fillColor(C.muted).font("Helvetica").fontSize(7.5).text("Este reporte queda registrado en la auditoría del sistema.", M, doc.y, { width: contentWidth(doc) });
  doc.moveDown(0.9);
};

/** Título de sección con barra lima; reserva `keepWith` pt para que no quede solo al pie de la página. */
export const sectionTitle = (doc: Doc, text: string, keepWith = 140, intro?: string): void => {
  ensureSpace(doc, keepWith);
  const y = doc.y + 4;
  doc.save().rect(M, y + 2, 4, 14).fill(C.lime).restore();
  doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(12).text(text.toUpperCase(), M + 12, y + 2, { characterSpacing: 0.4, lineBreak: false });
  doc.x = M;
  doc.y = y + 20;
  if (intro) {
    doc.fillColor(C.ink2).font("Helvetica").fontSize(8.5).text(intro, M, doc.y, { width: contentWidth(doc) });
    doc.moveDown(0.4);
  }
  doc.y += 2;
};

// ------------------------------------------------------------------ bloques de texto

/** Estado vacío explícito: la sección existe, pero no hay datos que mostrar. */
export const emptyState = (doc: Doc, message: string, hint?: string): void => {
  ensureSpace(doc, 48);
  const y = doc.y + 2;
  doc.save().roundedRect(M, y, contentWidth(doc), 40, 6).lineWidth(0.8).dash(3, { space: 3 }).strokeColor(C.line).stroke().undash().restore();
  doc.fillColor(C.ink2).font("Helvetica-Bold").fontSize(9).text(message, M + 14, y + 9, { width: contentWidth(doc) - 28, lineBreak: false });
  if (hint) doc.fillColor(C.muted).font("Helvetica").fontSize(8).text(hint, M + 14, y + 22, { width: contentWidth(doc) - 28, lineBreak: false });
  doc.x = M;
  doc.y = y + 50;
};

/** Resumen ejecutivo: cuadro con párrafos cortos, todos construidos con cifras del reporte. */
export const summaryBox = (doc: Doc, paragraphs: string[], title = "Resumen ejecutivo"): void => {
  if (paragraphs.length === 0) return;
  const w = contentWidth(doc) - 28;
  doc.font("Helvetica").fontSize(9.5);
  const heights = paragraphs.map((p) => doc.heightOfString(p, { width: w, lineGap: 1.5 }));
  const h = 30 + heights.reduce((s, x) => s + x, 0) + (paragraphs.length - 1) * 5;
  ensureSpace(doc, h + 8);
  const y = doc.y + 2;
  doc.save().roundedRect(M, y + 1.5, contentWidth(doc), h, 7).fill(C.shadow).restore();
  doc.save().roundedRect(M, y, contentWidth(doc), h, 7).fill(C.greenSoft).restore();
  doc.save().rect(M, y + 8, 3.5, h - 16).fill(C.green).restore();
  doc.fillColor(C.olive).font("Helvetica-Bold").fontSize(8).text(title.toUpperCase(), M + 14, y + 10, { characterSpacing: 0.8, lineBreak: false });
  let cy = y + 24;
  paragraphs.forEach((p, i) => {
    doc.fillColor(C.ink).font("Helvetica").fontSize(9.5).text(p, M + 14, cy, { width: w, lineGap: 1.5 });
    cy += heights[i]! + 5;
  });
  doc.x = M;
  doc.y = y + h + 12;
};

export type Finding = { tone: Tone; title: string; text: string };

/** Hallazgos y alertas: cada uno debe estar respaldado por cifras del propio reporte. */
export const findings = (doc: Doc, items: Finding[], emptyMessage = "Sin hallazgos que reportar con los datos de este reporte."): void => {
  if (items.length === 0) {
    emptyState(doc, emptyMessage);
    return;
  }
  const w = contentWidth(doc) - 26;
  items.forEach((f) => {
    doc.font("Helvetica-Bold").fontSize(9);
    const th = doc.heightOfString(f.title, { width: w });
    doc.font("Helvetica").fontSize(8.5);
    const bh = doc.heightOfString(f.text, { width: w, lineGap: 1 });
    const h = th + bh + 12;
    ensureSpace(doc, h + 6);
    const y = doc.y;
    doc.save().roundedRect(M, y, contentWidth(doc), h, 5).lineWidth(0.6).strokeColor(C.line).stroke().restore();
    doc.save().roundedRect(M, y, 4, h, 2).fill(TONE[f.tone].solid).restore();
    doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(9).text(f.title, M + 16, y + 6, { width: w });
    doc.fillColor(C.ink2).font("Helvetica").fontSize(8.5).text(f.text, M + 16, y + 6 + th + 1, { width: w, lineGap: 1 });
    doc.x = M;
    doc.y = y + h + 6;
  });
  doc.y += 4;
};

/** Criterios de cálculo: cómo se obtuvo cada cifra, en lista corta. */
export const criteria = (doc: Doc, lines: string[], title = "Criterios de cálculo"): void => {
  if (lines.length === 0) return;
  const w = contentWidth(doc) - 12;
  doc.font("Helvetica").fontSize(7.8);
  const hs = lines.map((l) => doc.heightOfString(l, { width: w, lineGap: 1 }));
  ensureSpace(doc, 16 + hs[0]!);
  doc.fillColor(C.muted).font("Helvetica-Bold").fontSize(7.5).text(title.toUpperCase(), M, doc.y, { characterSpacing: 0.7, lineBreak: false });
  doc.y += 12;
  lines.forEach((l, i) => {
    ensureSpace(doc, hs[i]! + 3);
    const y = doc.y;
    doc.save().circle(M + 3, y + 4, 1.2).fill(C.muted).restore();
    doc.fillColor(C.ink2).font("Helvetica").fontSize(7.8).text(l, M + 12, y, { width: w, lineGap: 1 });
    doc.x = M;
    doc.y = y + hs[i]! + 3;
  });
  doc.y += 4;
};

export const note = (doc: Doc, text: string): void => {
  doc.font("Helvetica-Oblique").fontSize(8);
  ensureSpace(doc, doc.heightOfString(text, { width: contentWidth(doc) }) + 4);
  doc.fillColor(C.muted).text(text, M, doc.y, { width: contentWidth(doc) });
  doc.moveDown(0.5);
};

// ------------------------------------------------------------------ indicadores

export type Kpi = { label: string; value: string; hint?: string | undefined; tone?: Tone | undefined };

/** Tarjetas de indicadores en filas de hasta 4. «N/D» y «N/A» se atenúan para no confundirlas con cero. */
export const kpis = (doc: Doc, items: Kpi[]): void => {
  if (items.length === 0) return;
  const perRow = items.length === 5 || items.length === 6 || items.length === 3 ? 3 : 4;
  const gap = 10;
  const h = 62;
  for (let i = 0; i < items.length; i += perRow) {
    const rowItems = items.slice(i, i + perRow);
    ensureSpace(doc, h + 12);
    const w = (contentWidth(doc) - gap * (perRow - 1)) / perRow;
    const y = doc.y;
    rowItems.forEach((k, j) => {
      const x = M + j * (w + gap);
      const missing = isMissing(k.value);
      doc.save().roundedRect(x, y + 1.5, w, h, 7).fill(C.shadow).restore();
      doc.save().roundedRect(x, y, w, h, 7).fill("#FFFFFF").restore();
      doc.save().roundedRect(x, y, w, h, 7).lineWidth(0.7).strokeColor(C.line).stroke().restore();
      doc.save().roundedRect(x + 8, y + 10, 3, h - 20, 1.5).fill(TONE[k.tone ?? "neutral"].solid).restore();
      doc.font("Helvetica-Bold").fontSize(7);
      doc.fillColor(C.muted).text(fitText(doc, k.label.toUpperCase(), w - 26), x + 18, y + 9, { width: w - 26, lineBreak: false });
      doc.fillColor(missing ? C.muted : C.ink).font("Helvetica-Bold").fontSize(15).text(fitText(doc, k.value, w - 26), x + 18, y + 21, { width: w - 26, lineBreak: false });
      if (k.hint) doc.fillColor(C.muted).font("Helvetica").fontSize(7.5).text(fitText(doc, k.hint, w - 26), x + 18, y + 43, { width: w - 26, lineBreak: false });
    });
    doc.x = M;
    doc.y = y + h + 12;
  }
};

// ------------------------------------------------------------------ gráficos

/** Recorta un texto con «…» para que quepa en una línea del ancho dado (fuente actual). */
export const fitText = (doc: Doc, text: string, width: number): string => {
  if (doc.widthOfString(text) <= width) return text;
  let t = text;
  while (t.length > 1 && doc.widthOfString(`${t}…`) > width) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
};

type ChartOpts = { height?: number | undefined; format?: ((n: number) => string) | undefined; color?: string | undefined; title?: string | undefined; caption?: string | undefined };

/** Título y leyenda de unidades de un gráfico; devuelve la altura que ocupa. */
const chartHead = (doc: Doc, opts: ChartOpts, needed: number): void => {
  const extra = opts.title ? 26 : 0;
  ensureSpace(doc, needed + extra);
  if (!opts.title) return;
  doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(9.5).text(opts.title, M, doc.y, { width: contentWidth(doc), lineBreak: false });
  if (opts.caption) doc.fillColor(C.muted).font("Helvetica").fontSize(7.5).text(opts.caption, M, doc.y + 1, { width: contentWidth(doc), lineBreak: false });
  doc.x = M;
  doc.y += opts.caption ? 22 : 16;
};

const noValues = (data: { value: number }[]): boolean => data.length === 0 || data.every((d) => d.value === 0);

/** Barras verticales con eje, etiquetas y valor sobre las barras; admite valores negativos (en rojo). */
export const barChart = (doc: Doc, data: { label: string; value: number }[], opts: ChartOpts & { empty?: string } = {}): void => {
  if (noValues(data)) {
    if (opts.title) chartHead(doc, opts, 50);
    emptyState(doc, opts.empty ?? "Sin valores para graficar en este periodo.");
    return;
  }
  const height = opts.height ?? 150;
  chartHead(doc, opts, height + 44);
  const width = contentWidth(doc);
  const top = doc.y + 8;
  const left = M + 46;
  const plotW = width - 46;
  const maxV = Math.max(0, ...data.map((d) => d.value));
  const minV = Math.min(0, ...data.map((d) => d.value));
  const range = maxV - minV || 1;
  const yOf = (v: number): number => top + height - ((v - minV) / range) * height;
  const fmt = opts.format ?? moneyShort;
  doc.font("Helvetica").fontSize(7).fillColor(C.muted);
  for (let i = 0; i <= 4; i++) {
    const v = minV + (range * i) / 4;
    const y = yOf(v);
    doc.save().moveTo(left, y).lineTo(M + width, y).lineWidth(0.5).strokeColor(C.line).stroke().restore();
    doc.fillColor(C.muted).text(fmt(v), M, y - 3.5, { width: 42, align: "right", lineBreak: false });
  }
  const zeroY = yOf(0);
  if (minV < 0) doc.save().moveTo(left, zeroY).lineTo(M + width, zeroY).lineWidth(0.9).strokeColor(C.ink2).stroke().restore();
  const slot = plotW / Math.max(1, data.length);
  const bw = Math.min(28, slot * 0.68);
  data.forEach((d, i) => {
    const yv = yOf(d.value);
    const x = left + i * slot + (slot - bw) / 2;
    doc.save().rect(x, Math.min(zeroY, yv), bw, Math.max(0.6, Math.abs(zeroY - yv))).fill(d.value < 0 ? C.bad : opts.color ?? C.green).restore();
    if (data.length <= 14) {
      const inside = d.value < 0 && Math.abs(zeroY - yv) >= 16;
      const ly = d.value < 0 ? (inside ? yv - 10 : yv + 2) : yv - 9;
      doc.fillColor(inside ? "#FFFFFF" : C.ink2).fontSize(6.5).text(fmt(d.value), x - 14, ly, { width: bw + 28, align: "center", lineBreak: false });
    }
    const showLabel = data.length <= 16 || i % Math.ceil(data.length / 12) === 0;
    if (showLabel) doc.fillColor(C.muted).fontSize(6.5).text(d.label, left + i * slot - 6, top + height + 5, { width: slot + 12, align: "center", lineBreak: false });
  });
  doc.x = M;
  doc.y = top + height + 24;
};

/** Línea con puntos y valores; admite negativos. Útil para flujos acumulados o series cortas. */
export const lineChart = (doc: Doc, data: { label: string; value: number }[], opts: ChartOpts & { empty?: string } = {}): void => {
  if (data.length < 2) {
    if (opts.title) chartHead(doc, opts, 50);
    emptyState(doc, opts.empty ?? "Se necesitan al menos dos puntos para trazar la serie.");
    return;
  }
  const height = opts.height ?? 140;
  chartHead(doc, opts, height + 44);
  const width = contentWidth(doc);
  const top = doc.y + 8;
  const left = M + 46;
  const plotW = width - 56;
  const maxV = Math.max(0, ...data.map((d) => d.value));
  const minV = Math.min(0, ...data.map((d) => d.value));
  const range = maxV - minV || 1;
  const yOf = (v: number): number => top + height - ((v - minV) / range) * height;
  const fmt = opts.format ?? moneyShort;
  doc.font("Helvetica").fontSize(7);
  for (let i = 0; i <= 4; i++) {
    const v = minV + (range * i) / 4;
    const y = yOf(v);
    doc.save().moveTo(left, y).lineTo(M + width, y).lineWidth(0.5).strokeColor(C.line).stroke().restore();
    doc.fillColor(C.muted).text(fmt(v), M, y - 3.5, { width: 42, align: "right", lineBreak: false });
  }
  if (minV < 0) doc.save().moveTo(left, yOf(0)).lineTo(M + width, yOf(0)).lineWidth(0.9).strokeColor(C.ink2).stroke().restore();
  const step = plotW / (data.length - 1);
  const pts = data.map((d, i) => ({ x: left + 6 + i * step * ((plotW - 6) / plotW), y: yOf(d.value), d }));
  doc.save().lineWidth(1.6).strokeColor(opts.color ?? C.green);
  pts.forEach((p, i) => (i === 0 ? doc.moveTo(p.x, p.y) : doc.lineTo(p.x, p.y)));
  doc.stroke().restore();
  pts.forEach((p, i) => {
    doc.save().circle(p.x, p.y, 2.6).fill(p.d.value < 0 ? C.bad : opts.color ?? C.green).restore();
    if (data.length <= 12) doc.fillColor(C.ink2).font("Helvetica").fontSize(6.5).text(fmt(p.d.value), p.x - 24, p.y - 11, { width: 48, align: "center", lineBreak: false });
    if (data.length <= 16 || i % Math.ceil(data.length / 12) === 0) doc.fillColor(C.muted).fontSize(6.5).text(p.d.label, p.x - 24, top + height + 5, { width: 48, align: "center", lineBreak: false });
  });
  doc.x = M;
  doc.y = top + height + 24;
};

/** Barras horizontales (ranking): etiqueta a la izquierda, barra y valor. */
export const hbarChart = (doc: Doc, data: { label: string; value: number; color?: string }[], opts: ChartOpts & { empty?: string } = {}): void => {
  if (noValues(data)) {
    if (opts.title) chartHead(doc, opts, 50);
    emptyState(doc, opts.empty ?? "Sin valores para graficar.");
    return;
  }
  const rowH = 17;
  chartHead(doc, opts, Math.min(data.length, 6) * rowH + 16);
  const width = contentWidth(doc);
  const labelW = 170;
  const barMax = width - labelW - 80;
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = opts.format ?? money;
  let y = doc.y + 4;
  data.forEach((d, i) => {
    if (y + rowH > limitY(doc)) {
      doc.addPage();
      y = TOP;
    }
    doc.fillColor(C.ink).font("Helvetica").fontSize(8.5).text(fitText(doc, d.label, labelW - 10), M, y + 3, { width: labelW - 8, lineBreak: false });
    doc.save().roundedRect(M + labelW, y + 3, barMax, 9, 4).fill(C.zebra).restore();
    doc.save().roundedRect(M + labelW, y + 3, Math.max(2, (d.value / max) * barMax), 9, 4).fill(d.color ?? opts.color ?? C.green).restore();
    doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(8.5).text(fmt(d.value), M + labelW + barMax + 6, y + 3, { width: 74, align: "right", lineBreak: false });
    y += rowH;
  });
  doc.x = M;
  doc.y = y + 8;
};

/** Dona con leyenda a la derecha (cada porción con su valor y porcentaje). */
export const donut = (doc: Doc, data: { label: string; value: number }[], opts: ChartOpts & { empty?: string } = {}): void => {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0);
  if (total <= 0) {
    if (opts.title) chartHead(doc, opts, 50);
    emptyState(doc, opts.empty ?? "Sin valores para mostrar la distribución.");
    return;
  }
  const r = 52;
  const legendH = data.length * 15;
  chartHead(doc, opts, Math.max(r * 2 + 20, legendH + 10));
  const cx = M + r + 6;
  const cy = doc.y + r + 6;
  let a0 = -Math.PI / 2;
  data.forEach((d, i) => {
    const frac = Math.max(0, d.value) / total;
    const a1 = a0 + frac * Math.PI * 2;
    if (frac >= 0.9999) doc.save().circle(cx, cy, r).fill(C.chart[i % C.chart.length]).restore();
    else if (frac > 0) {
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
    doc.fillColor(C.ink).font("Helvetica").fontSize(8.5).text(`${d.label}  ·  ${fmt(d.value)}  (${Math.round((Math.max(0, d.value) / total) * 100)} %)`, cx + r + 40, ly + 2, { width: contentWidth(doc) - r * 2 - 60, lineBreak: false });
    ly += 15;
  });
  doc.x = M;
  doc.y = Math.max(cy + r + 14, ly + 6);
};

// ------------------------------------------------------------------ tablas

export type Col = { title: string; width: number; align?: "left" | "right" | "center" };
export type TableOpts = {
  /** Fila de totales (misma cantidad de celdas que columnas). Úsela solo si la suma tiene sentido. */
  totals?: string[];
  /** Devuelve un tono para dibujar la celda como etiqueta de estado; undefined = texto normal. */
  tag?: (row: string[], col: number) => Tone | undefined;
  /** Mensaje cuando no hay filas. */
  empty?: string;
  title?: string;
};

/** Tabla con encabezado diferenciado, filas alternas, encabezado repetido, sin cortar filas ni dejar el título huérfano. */
export const table = (doc: Doc, cols: Col[], rows: string[][], opts: TableOpts = {}): void => {
  if (opts.title) {
    ensureSpace(doc, 70);
    doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(9.5).text(opts.title, M, doc.y, { width: contentWidth(doc), lineBreak: false });
    doc.x = M;
    doc.y += 16;
  }
  if (rows.length === 0) {
    emptyState(doc, opts.empty ?? "Sin registros para mostrar.");
    return;
  }
  const width = contentWidth(doc);
  const total = cols.reduce((s, c) => s + c.width, 0);
  const ws = cols.map((c) => (c.width / total) * width);
  const ROW = 16;
  const drawHead = (): void => {
    const y = doc.y;
    doc.save().roundedRect(M, y, width, 19, 3).fill(C.ink).restore();
    let x = M;
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(7.2);
    cols.forEach((c, i) => {
      doc.text(fitText(doc, c.title.toUpperCase(), ws[i]! - 12), x + 6, y + 6, { width: ws[i]! - 12, align: c.align ?? "left", lineBreak: false });
      x += ws[i]!;
    });
    doc.y = y + 21;
  };
  const drawRow = (r: string[], zebra: boolean, bold: boolean, topRule: boolean): void => {
    if (doc.y + ROW > limitY(doc)) {
      doc.addPage();
      doc.x = M;
      doc.y = TOP;
      drawHead();
    }
    const y = doc.y;
    if (zebra) doc.save().rect(M, y, width, ROW).fill(C.zebra).restore();
    if (topRule) doc.save().moveTo(M, y).lineTo(M + width, y).lineWidth(1).strokeColor(C.ink).stroke().restore();
    doc.save().moveTo(M, y + ROW).lineTo(M + width, y + ROW).lineWidth(0.4).strokeColor(C.line).stroke().restore();
    let x = M;
    r.forEach((cell, i) => {
      const align = cols[i]!.align ?? "left";
      const tone = bold ? undefined : opts.tag?.(r, i);
      const cw = ws[i]! - 12;
      if (tone) {
        doc.font("Helvetica-Bold").fontSize(7);
        const tw = Math.min(cw, doc.widthOfString(cell) + 12);
        const tx = align === "right" ? x + ws[i]! - 6 - tw : align === "center" ? x + (ws[i]! - tw) / 2 : x + 6;
        doc.save().roundedRect(tx, y + 3, tw, 10, 5).fill(TONE[tone].bg).restore();
        doc.fillColor(TONE[tone].fg).text(fitText(doc, cell, tw - 8), tx + 4, y + 5.2, { width: tw - 8, align: "center", lineBreak: false });
      } else {
        const missing = isMissing(cell);
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor(missing ? C.muted : C.ink);
        doc.text(fitText(doc, cell, cw), x + 6, y + 4.5, { width: cw, align, lineBreak: false });
      }
      x += ws[i]!;
    });
    doc.y = y + ROW;
  };
  ensureSpace(doc, 21 + Math.min(rows.length + (opts.totals ? 1 : 0), 4) * ROW);
  drawHead();
  rows.forEach((r, ri) => drawRow(r, ri % 2 === 1, false, false));
  if (opts.totals) drawRow(opts.totals, false, true, true);
  doc.x = M;
  doc.moveDown(0.8);
};

// ------------------------------------------------------------------ bloques y pie

/**
 * Bloque de un reporte: se puede ocultar, reordenar o activar según los datos disponibles.
 * `when: false` lo omite (por ejemplo, un gráfico sin datos); `plan.hide` y `plan.order` permiten
 * adaptar la composición por tipo de reporte sin tocar el estilo.
 */
export type Block = { id: string; render: () => void; when?: boolean | undefined };
export type BlockPlan = { order?: string[] | undefined; hide?: string[] | undefined };

export const composeBlocks = (blocks: Block[], plan: BlockPlan = {}): Block[] => {
  const hide = new Set(plan.hide ?? []);
  const visible = blocks.filter((b) => b.when !== false && !hide.has(b.id));
  const rank = (id: string): number => {
    const i = plan.order?.indexOf(id) ?? -1;
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const originalIndex = new Map(visible.map((b, i) => [b.id, i]));
  return [...visible].sort((a, b) => rank(a.id) - rank(b.id) || originalIndex.get(a.id)! - originalIndex.get(b.id)!);
};

export const runBlocks = (blocks: Block[], plan: BlockPlan = {}): void => {
  composeBlocks(blocks, plan).forEach((b) => b.render());
};

/** Pie en todas las páginas, encabezado de continuación desde la 2.ª y «Página n de N». */
export const finish = (doc: Doc, reportName: string): void => {
  const range = doc.bufferedPageRange();
  const meta = running.get(doc);
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // escribir el pie sin que pdfkit agregue una página
    const w = doc.page.width;
    if (i > range.start) {
      logo(doc, M, 20, 16);
      doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(8).text((meta?.title ?? reportName).toUpperCase(), M + 24, 24, { width: 300, characterSpacing: 0.5, lineBreak: false });
      if (meta?.context) doc.fillColor(C.muted).font("Helvetica").fontSize(7.5).text(meta.context, w - M - 220, 24, { width: 220, align: "right", lineBreak: false });
      doc.save().moveTo(M, 42).lineTo(w - M, 42).lineWidth(0.5).strokeColor(C.line).stroke().restore();
    }
    const y = doc.page.height - 40;
    doc.save().moveTo(M, y - 8).lineTo(w - M, y - 8).lineWidth(0.5).strokeColor(C.line).stroke().restore();
    doc.fillColor(C.muted).font("Helvetica").fontSize(7.5);
    doc.text(`Mi Tierrita SIG · ${reportName} · datos de demostración simulados`, M, y, { width: 360, lineBreak: false });
    doc.fillColor(C.ink2).font("Helvetica-Bold").text(`Página ${i - range.start + 1} de ${range.count}`, w - M - 120, y, { width: 120, align: "right", lineBreak: false });
  }
  doc.end();
};
