/**
 * Erzeugt ein Rechnungs-PDF (A4) mit pdf-lib.
 * Kleinunternehmer §19 UStG — keine Umsatzsteuer.
 * Beträge in Cent. Euro-Anzeige als "1.234,56 EUR" (encoding-sicher).
 */
import {
  PDFDocument,
  AFRelationship,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { generateZugferdXml } from "./zugferd";

export interface InvoicePdfData {
  profile: {
    name: string;
    address: string | null;
    steuernummer: string | null;
    iban: string | null;
    kleinunternehmerHinweis: string | null;
  };
  customer: { name: string; address: string | null };
  invoice: { number: string; date: string; total: number };
  items: { description: string; quantity: number; unitPrice: number }[];
  logo: Uint8Array | null;
}

const BRAND = rgb(0.357, 0.18, 0.898); // #5B2EE5
const GREY = rgb(0.42, 0.45, 0.5);
const BLACK = rgb(0.07, 0.07, 0.07);

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

/** Bricht Text in Zeilen um, die in maxWidth passen (inkl. Hard-Break sehr langer Wörter). */
function wrapText(
  s: string,
  f: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  const fits = (t: string) => f.widthOfTextAtSize(t, size) <= maxWidth;

  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (fits(test)) {
      cur = test;
      continue;
    }
    if (cur) lines.push(cur);
    if (fits(w)) {
      cur = w;
    } else {
      // Wort zu lang → zeichenweise umbrechen
      let chunk = "";
      for (const ch of w) {
        if (fits(chunk + ch)) chunk += ch;
        else {
          if (chunk) lines.push(chunk);
          chunk = ch;
        }
      }
      cur = chunk;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

export async function generateInvoicePdf(
  data: InvoicePdfData,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width: W, height: H } = page.getSize();
  const M = 50;

  const text = (
    s: string,
    x: number,
    y: number,
    size = 10,
    f: PDFFont = font,
    color = BLACK,
  ) => page.drawText(s, { x, y, size, font: f, color });

  const right = (
    s: string,
    xRight: number,
    y: number,
    size = 10,
    f: PDFFont = font,
    color = BLACK,
  ) => text(s, xRight - f.widthOfTextAtSize(s, size), y, size, f, color);

  // Logo oben rechts
  if (data.logo) {
    try {
      const img = await pdf.embedPng(data.logo);
      const w = 120;
      const h = (img.height / img.width) * w;
      page.drawImage(img, { x: W - M - w, y: H - M - h + 10, width: w, height: h });
    } catch {
      /* Logo optional */
    }
  }

  // Absender (Firma) oben links
  let y = H - M - 6;
  text(data.profile.name, M, y, 15, bold, BRAND);
  y -= 16;
  for (const line of (data.profile.address ?? "").split("\n")) {
    if (line.trim()) {
      text(line.trim(), M, y, 9, font, GREY);
      y -= 12;
    }
  }

  // Titel
  y = H - 165;
  text("RECHNUNG", M, y, 22, bold, BLACK);

  // Empfänger
  let cy = y - 35;
  text("RECHNUNG AN", M, cy, 8, bold, GREY);
  cy -= 15;
  text(data.customer.name, M, cy, 11, bold);
  cy -= 14;
  for (const line of (data.customer.address ?? "").split("\n")) {
    if (line.trim()) {
      text(line.trim(), M, cy, 10, font, BLACK);
      cy -= 13;
    }
  }

  // Meta rechts
  let my = y - 35;
  right(`Rechnungsnr.: ${data.invoice.number}`, W - M, my, 10, font);
  my -= 15;
  right(`Datum: ${formatDate(data.invoice.date)}`, W - M, my, 10, font);
  my -= 15;
  right(`Leistungsdatum: ${formatDate(data.invoice.date)}`, W - M, my, 10, font, GREY);

  // Positionstabelle
  const colPos = M;
  const colDesc = M + 30;
  const colQty = 360;
  const colUnit = 430;
  const colSum = W - M;
  const descMaxWidth = colQty - 20 - colDesc; // Platz bis zur Mengenspalte
  const BOTTOM = 110; // Platz für Hinweis/Fußzeile freihalten

  const drawTableHeader = (atY: number): number => {
    page.drawRectangle({
      x: M,
      y: atY - 4,
      width: W - 2 * M,
      height: 20,
      color: rgb(0.95, 0.95, 0.97),
    });
    text("Pos", colPos + 2, atY + 2, 8, bold, GREY);
    text("Beschreibung", colDesc, atY + 2, 8, bold, GREY);
    right("Menge", colQty + 30, atY + 2, 8, bold, GREY);
    right("Einzel", colUnit + 40, atY + 2, 8, bold, GREY);
    right("Gesamt", colSum, atY + 2, 8, bold, GREY);
    return atY - 22;
  };

  let ty = drawTableHeader(Math.min(cy, my) - 30);

  data.items.forEach((it, idx) => {
    const descLines = wrapText(it.description, font, 10, descMaxWidth);
    const rowHeight = Math.max(18, descLines.length * 13 + 5);

    // Seitenumbruch, wenn die Zeile nicht mehr passt
    if (ty - rowHeight < BOTTOM) {
      page = pdf.addPage([W, H]);
      ty = drawTableHeader(H - 60);
    }

    const lineSum = it.quantity * it.unitPrice;
    text(String(idx + 1), colPos + 2, ty, 10);
    descLines.forEach((ln, i) => text(ln, colDesc, ty - i * 13, 10));
    right(String(it.quantity), colQty + 30, ty, 10);
    right(euro(it.unitPrice), colUnit + 40, ty, 10);
    right(euro(lineSum), colSum, ty, 10);
    ty -= rowHeight;
    page.drawLine({
      start: { x: M, y: ty + 6 },
      end: { x: W - M, y: ty + 6 },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.92),
    });
  });

  // Summe (ggf. auf neuer Seite)
  if (ty - 60 < BOTTOM) {
    page = pdf.addPage([W, H]);
    ty = H - 80;
  }
  ty -= 10;
  right("Gesamtbetrag", colUnit + 40, ty, 11, bold);
  right(euro(data.invoice.total), colSum, ty, 13, bold, BRAND);

  // §19-Hinweis
  ty -= 30;
  const hint =
    data.profile.kleinunternehmerHinweis ??
    "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmer).";
  for (const ln of wrapText(hint, font, 9, W - 2 * M)) {
    text(ln, M, ty, 9, font, GREY);
    ty -= 12;
  }

  // Fußzeile
  drawFooter(page, font, data, W, M);

  // Factur-X MINIMUM XML einbetten (E-Rechnungspflicht §14 UStG ab 2025).
  const zugferdXml = generateZugferdXml({
    invoiceNumber: data.invoice.number,
    invoiceDate: data.invoice.date,
    sellerName: data.profile.name,
    steuernummer: data.profile.steuernummer,
    buyerName: data.customer.name,
    totalCents: data.invoice.total,
  });
  await pdf.attach(new TextEncoder().encode(zugferdXml), "factur-x.xml", {
    mimeType: "text/xml; charset=utf-8",
    description: "Factur-X Invoice",
    creationDate: new Date(),
    modificationDate: new Date(),
    afRelationship: AFRelationship.Alternative,
  });

  return pdf.save();
}

function drawFooter(
  page: PDFPage,
  font: PDFFont,
  data: InvoicePdfData,
  W: number,
  M: number,
) {
  let fy = 70;
  const parts: string[] = [];
  if (data.profile.steuernummer)
    parts.push(`Steuernummer: ${data.profile.steuernummer}`);
  if (data.profile.iban) parts.push(`IBAN: ${data.profile.iban}`);
  page.drawLine({
    start: { x: M, y: fy + 12 },
    end: { x: W - M, y: fy + 12 },
    thickness: 0.5,
    color: rgb(0.88, 0.88, 0.9),
  });
  for (const p of parts) {
    page.drawText(p, { x: M, y: fy, size: 9, font, color: GREY });
    fy -= 12;
  }
}
