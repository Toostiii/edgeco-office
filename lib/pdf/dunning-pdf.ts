/**
 * Erzeugt ein Mahnungs-PDF (A4) mit pdf-lib.
 * 1. Mahnung = Zahlungserinnerung, 2. Mahnung = strengerer Ton.
 * Beträge in Cent. Euro-Anzeige als "1.234,56 EUR" (encoding-sicher).
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

export interface DunningPdfData {
  level: 1 | 2;
  profile: {
    name: string;
    address: string | null;
    steuernummer: string | null;
    iban: string | null;
  };
  customer: { name: string; address: string | null };
  invoice: {
    number: string;
    date: string;
    total: number;
    dueDate: string | null;
  };
  /** Tage seit Fälligkeit (>= 0). */
  daysOverdue: number;
  /** Neues Zahlungsziel (z. B. heute + 7 Tage), ISO. */
  payUntil: string;
  /** Heutiges Datum (Mahndatum), ISO. */
  today: string;
  logo: Uint8Array | null;
}

const BRAND = rgb(0.357, 0.18, 0.898); // #5B2EE5
const GREY = rgb(0.42, 0.45, 0.5);
const BLACK = rgb(0.07, 0.07, 0.07);
const RED = rgb(0.78, 0.16, 0.16);

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
    cur = w;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

export async function generateDunningPdf(
  data: DunningPdfData,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
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

  // Absender
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
  const title = data.level === 1 ? "ZAHLUNGSERINNERUNG" : "2. MAHNUNG";
  y = H - 165;
  text(title, M, y, 22, bold, data.level === 1 ? BLACK : RED);

  // Empfänger
  let cy = y - 35;
  text("AN", M, cy, 8, bold, GREY);
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
  text(`Datum: ${formatDate(data.today)}`, W - M - 150, y - 35, 10, font);

  // Mahntext
  const body =
    data.level === 1
      ? `Sehr geehrte Damen und Herren, unsere Rechnung ${data.invoice.number} vom ${formatDate(data.invoice.date)} ist seit ${data.daysOverdue} Tagen fällig. Vermutlich ist dies Ihrer Aufmerksamkeit entgangen. Wir bitten Sie, den offenen Betrag von ${euro(data.invoice.total)} bis zum ${formatDate(data.payUntil)} auf das unten genannte Konto zu überweisen. Sollten Sie den Betrag bereits beglichen haben, betrachten Sie dieses Schreiben als gegenstandslos.`
      : `Sehr geehrte Damen und Herren, trotz unserer Zahlungserinnerung ist die Rechnung ${data.invoice.number} vom ${formatDate(data.invoice.date)} weiterhin offen. Der fällige Betrag von ${euro(data.invoice.total)} ist seit ${data.daysOverdue} Tagen überfällig. Wir fordern Sie hiermit letztmalig auf, den Betrag bis zum ${formatDate(data.payUntil)} zu begleichen. Andernfalls behalten wir uns weitere Schritte vor.`;

  let by = cy - 30;
  for (const ln of wrapText(body, font, 11, W - 2 * M)) {
    text(ln, M, by, 11, font, BLACK);
    by -= 16;
  }

  // Betragsbox
  by -= 20;
  text("Offener Betrag", M, by, 11, bold);
  text(euro(data.invoice.total), W - M - font.widthOfTextAtSize(euro(data.invoice.total), 13), by, 13, bold, data.level === 1 ? BRAND : RED);
  by -= 18;
  text(`Bitte zahlbar bis: ${formatDate(data.payUntil)}`, M, by, 10, font, GREY);

  // Fußzeile
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
    text(p, M, fy, 9, font, GREY);
    fy -= 12;
  }

  return pdf.save();
}
