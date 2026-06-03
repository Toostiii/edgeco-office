/**
 * Extrahiert Betrag und Datum aus dem OCR-Text eines Belegs (deutsche Belege).
 * Reine Logik — testbar, ohne OCR-Abhängigkeit. Beträge in Cent.
 */

export interface ParsedReceipt {
  amountCents: number | null;
  date: string | null; // yyyy-mm-dd
}

const KEYWORDS =
  /(summe|gesamt|total|zu\s*zahlen|endbetrag|brutto|betrag)/i;

function toCents(intPart: string, decPart: string): number {
  const cleaned = intPart.replace(/[.\s]/g, "");
  return parseInt(cleaned, 10) * 100 + parseInt(decPart, 10);
}

function extractAmount(text: string): number | null {
  // Deutsche Geldbeträge: "45,00", "1.234,56" (Komma als Dezimaltrenner).
  const re = /(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*,\s*(\d{2})(?!\d)/g;
  const all: number[] = [];
  const keyword: number[] = [];

  for (const line of text.split(/\r?\n/)) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      const cents = toCents(m[1], m[2]);
      if (cents <= 0) continue;
      all.push(cents);
      if (KEYWORDS.test(line)) keyword.push(cents);
    }
  }

  const pool = keyword.length > 0 ? keyword : all;
  return pool.length > 0 ? Math.max(...pool) : null;
}

function extractDate(text: string): string | null {
  const m = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (m[3].length === 2) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function parseReceiptText(text: string): ParsedReceipt {
  return {
    amountCents: extractAmount(text),
    date: extractDate(text),
  };
}
