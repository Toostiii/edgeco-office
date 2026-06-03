/**
 * Erzeugt eine EÜR-Jahresauswertung als PDF (A4) mit pdf-lib.
 * Gewinnermittlung nach § 4 Abs. 3 EStG, Kleinunternehmer § 19 UStG.
 * Beträge in Cent. Euro-Anzeige als "1.234,56 EUR" (encoding-sicher, kein €).
 */
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
} from "pdf-lib";

export interface EurPdfData {
  profile: {
    name: string;
    address: string | null;
    steuernummer: string | null;
    iban: string | null;
    kleinunternehmerHinweis: string | null;
  };
  year: number;
  /** Betriebseinnahmen (Cent) */
  income: number;
  /** Betriebsausgaben ohne AfA (Cent) */
  expenses: number;
  /** Abschreibungen des Jahres (Cent) */
  depreciation: number;
  /** Gewinn/Verlust nach EÜR inkl. AfA (Cent) */
  profit: number;
  incomeCategories: { label: string; amount: number }[];
  expenseCategories: { label: string; amount: number }[];
  assets: {
    name: string;
    purchaseDate: string;
    cost: number;
    afa: number;
    bookValueEnd: number;
  }[];
  /** ISO-Zeitstempel der Erstellung */
  generatedAt: string;
  logo: Uint8Array | null;
}

const BRAND = rgb(0.357, 0.18, 0.898); // #5B2EE5
const GREY = rgb(0.42, 0.45, 0.5);
const BLACK = rgb(0.07, 0.07, 0.07);
const INCOME = rgb(0.09, 0.55, 0.32);
const EXPENSE = rgb(0.78, 0.16, 0.21);

function euro(cents: number): string {
  return (
    (cents / 100).toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " EUR"
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Bricht Text in Zeilen um, die in maxWidth passen. */
function wrapText(
  s: string,
  f: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (f.widthOfTextAtSize(test, size) <= maxWidth) {
      cur = test;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

export async function generateEurPdf(data: EurPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28;
  const H = 841.89; // A4
  const M = 50;
  const BOTTOM = 90;

  let page = pdf.addPage([W, H]);
  let y = H - M;

  const text = (
    s: string,
    x: number,
    yy: number,
    size = 10,
    f: PDFFont = font,
    color = BLACK,
  ) => page.drawText(s, { x, y: yy, size, font: f, color });

  const right = (
    s: string,
    xRight: number,
    yy: number,
    size = 10,
    f: PDFFont = font,
    color = BLACK,
  ) => text(s, xRight - f.widthOfTextAtSize(s, size), yy, size, f, color);

  const line = (yy: number, color = rgb(0.85, 0.85, 0.88), thickness = 0.5) =>
    page.drawLine({
      start: { x: M, y: yy },
      end: { x: W - M, y: yy },
      thickness,
      color,
    });

  const newPage = () => {
    page = pdf.addPage([W, H]);
    y = H - M;
  };
  const ensure = (space: number) => {
    if (y - space < BOTTOM) newPage();
  };

  const clip = (s: string, f: PDFFont, size: number, maxW: number): string => {
    if (f.widthOfTextAtSize(s, size) <= maxW) return s;
    let t = s;
    while (t.length > 1 && f.widthOfTextAtSize(`${t}...`, size) > maxW) {
      t = t.slice(0, -1);
    }
    return `${t}...`;
  };

  const section = (title: string) => {
    ensure(40);
    y -= 22;
    text(title, M, y, 12, bold, BRAND);
    y -= 6;
    line(y);
    y -= 16;
  };

  const kv = (label: string, amount: number, strong = false, color = BLACK) => {
    ensure(16);
    const f = strong ? bold : font;
    text(label, M + 2, y, 10, f, color);
    right(euro(amount), W - M - 2, y, 10, f, color);
    y -= 15;
  };

  // Logo oben rechts
  if (data.logo) {
    try {
      const img = await pdf.embedPng(data.logo);
      const w = 110;
      const h = (img.height / img.width) * w;
      page.drawImage(img, { x: W - M - w, y: H - M - h + 6, width: w, height: h });
    } catch {
      /* Logo optional */
    }
  }

  // Firma oben links
  text(data.profile.name, M, y - 6, 15, bold, BRAND);
  y -= 24;
  for (const ln of (data.profile.address ?? "").split("\n")) {
    if (ln.trim()) {
      text(ln.trim(), M, y, 9, font, GREY);
      y -= 12;
    }
  }

  // Titel
  y -= 24;
  text(`Einnahmenüberschussrechnung ${data.year}`, M, y, 20, bold, BLACK);
  y -= 15;
  text(
    "Gewinnermittlung nach § 4 Abs. 3 EStG · Kleinunternehmer § 19 UStG",
    M,
    y,
    9,
    font,
    GREY,
  );
  y -= 8;
  line(y, rgb(0.8, 0.8, 0.84), 0.8);

  // Zusammenfassung
  section("Zusammenfassung");
  kv("Betriebseinnahmen", data.income);
  kv("Betriebsausgaben", -data.expenses);
  kv("Abschreibungen (AfA)", -data.depreciation);
  ensure(18);
  line(y + 9, rgb(0.7, 0.7, 0.74), 0.8);
  y -= 2;
  kv(
    data.profit >= 0 ? "Gewinn" : "Verlust",
    data.profit,
    true,
    data.profit >= 0 ? INCOME : EXPENSE,
  );

  // Betriebseinnahmen nach Kategorie
  section(`Betriebseinnahmen ${data.year}`);
  if (data.incomeCategories.length === 0) {
    ensure(16);
    text("Keine Einnahmen erfasst.", M + 2, y, 9, font, GREY);
    y -= 15;
  } else {
    for (const c of data.incomeCategories) kv(c.label, c.amount);
  }
  ensure(18);
  line(y + 9);
  y -= 2;
  kv("Summe Betriebseinnahmen", data.income, true);

  // Betriebsausgaben nach Kategorie (inkl. AfA-Zeile zur Abstimmung)
  section(`Betriebsausgaben ${data.year}`);
  if (data.expenseCategories.length === 0 && data.depreciation === 0) {
    ensure(16);
    text("Keine Ausgaben erfasst.", M + 2, y, 9, font, GREY);
    y -= 15;
  } else {
    for (const c of data.expenseCategories) kv(c.label, c.amount);
    if (data.depreciation > 0) kv("Abschreibungen (AfA)", data.depreciation);
  }
  ensure(18);
  line(y + 9);
  y -= 2;
  kv("Summe Betriebsausgaben", data.expenses + data.depreciation, true);

  // AfA im Detail
  if (data.assets.length > 0) {
    section(`Abschreibungen (AfA) ${data.year} im Detail`);
    const colBook = W - M - 2;
    const colAfa = colBook - 95;
    const colCost = colAfa - 95;
    const colDate = colCost - 100;
    const nameMax = colDate - 80 - (M + 2);

    ensure(18);
    text("Anlage", M + 2, y, 8, bold, GREY);
    right("Anschaffung", colDate, y, 8, bold, GREY);
    right("Kosten", colCost, y, 8, bold, GREY);
    right(`AfA ${data.year}`, colAfa, y, 8, bold, GREY);
    right("Buchwert Ende", colBook, y, 8, bold, GREY);
    y -= 4;
    line(y);
    y -= 13;

    for (const a of data.assets) {
      ensure(16);
      text(clip(a.name, font, 10, nameMax), M + 2, y, 10);
      right(formatDate(a.purchaseDate), colDate, y, 9);
      right(euro(a.cost), colCost, y, 9);
      right(euro(a.afa), colAfa, y, 9, font, EXPENSE);
      right(euro(a.bookValueEnd), colBook, y, 9);
      y -= 15;
    }
  }

  // Hinweise
  ensure(50);
  y -= 16;
  const hint =
    data.profile.kleinunternehmerHinweis ??
    "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmer).";
  for (const ln of wrapText(hint, font, 9, W - 2 * M)) {
    text(ln, M, y, 9, font, GREY);
    y -= 12;
  }
  for (const ln of wrapText(
    "Diese Auswertung dient der Vorbereitung der Anlage EÜR und ersetzt keine steuerliche Beratung.",
    font,
    9,
    W - 2 * M,
  )) {
    text(ln, M, y, 9, font, GREY);
    y -= 12;
  }

  // Fußzeile (aktuelle/letzte Seite)
  const parts: string[] = [];
  if (data.profile.steuernummer)
    parts.push(`Steuernummer: ${data.profile.steuernummer}`);
  if (data.profile.iban) parts.push(`IBAN: ${data.profile.iban}`);
  parts.push(
    `Erstellt am ${formatDate(data.generatedAt.slice(0, 10))} mit EDGECO Office`,
  );
  let fy = 58;
  line(fy + 13, rgb(0.88, 0.88, 0.9));
  for (const p of parts) {
    text(p, M, fy, 8, font, GREY);
    fy -= 11;
  }

  return pdf.save();
}
