/**
 * Bankkonto-CSV-Import: erkennt gängige deutsche Kontoauszug-Formate und
 * normalisiert sie zu BankRow[]. Beträge als Cent-Integer (positiv = Einnahme).
 *
 * Unterstützt: Sparkasse, ING, N26, Deutsche Bank + generischer Fallback.
 */

export interface BankRow {
  date: string; // ISO "YYYY-MM-DD"
  description: string;
  amountCents: number; // positiv = Einnahme, negativ = Ausgabe
}

/** Wandelt eine deutsche/englische Betragsangabe in Cent (mit Vorzeichen) um. */
function parseAmountToCents(input: string | undefined | null): number | null {
  if (!input) return null;
  let cleaned = input.trim().replace(/\s/g, "").replace(/[€$£]/g, "");
  if (!cleaned) return null;

  // Vorzeichen extrahieren (führendes oder nachgestelltes "-").
  let negative = false;
  if (cleaned.startsWith("-") || cleaned.endsWith("-")) negative = true;
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  cleaned = cleaned.replace(/[+-]/g, "");
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized: string;
  if (lastComma > -1 && lastDot > -1) {
    // Der spätere Trenner ist der Dezimaltrenner.
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    normalized = cleaned.replace(",", ".");
  } else {
    normalized = cleaned;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return negative ? -cents : cents;
}

function toIsoDate(input: string | undefined | null): string | null {
  if (!input) return null;
  const trimmed = input.trim().replace(/^"|"$/g, "");
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // dd.mm.yyyy oder dd.mm.yy
  const german = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{2}(?:\d{2})?)/);
  if (german) {
    const year = german[3].length === 2 ? `20${german[3]}` : german[3];
    return `${year}-${german[2]}-${german[1]}`;
  }
  // dd/mm/yyyy
  const slash = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (slash) return `${slash[3]}-${slash[2]}-${slash[1]}`;
  return null;
}

/** Erkennt den Trenner (; oder ,) anhand der häufigeren Vorkommen. */
function detectDelimiter(line: string): "," | ";" | "\t" {
  const semis = (line.match(/;/g) ?? []).length;
  const tabs = (line.match(/\t/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;
  if (tabs > semis && tabs > commas) return "\t";
  if (semis >= commas) return ";";
  return ",";
}

/** Einfacher CSV-Zeilen-Parser mit Quote-Unterstützung. */
function splitCsvLine(line: string, delim: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delim) {
      cells.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells.map((c) => c.trim().replace(/^"|"$/g, ""));
}

function normalizeHeader(h: string): string {
  return h
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

const DATE_KEYS = [
  "buchungstag",
  "buchung",
  "buchungsdatum",
  "valuta",
  "valutadatum",
  "wertstellung",
  "date",
  "datum",
];
const DESC_KEYS = [
  "verwendungszweck",
  "buchungstext",
  "beguenstigter/auftraggeber",
  "beguenstigter / auftraggeber",
  "name beguenstigter/zahlungspflichtiger",
  "payee",
  "auftraggeber",
  "empfaenger",
  "beschreibung",
  "description",
  "reference",
];
const AMOUNT_KEYS = [
  "betrag",
  "betrag (eur)",
  "amount",
  "amount (eur)",
  "umsatz",
  "value",
];

function findIndex(headers: string[], keys: string[]): number {
  for (const key of keys) {
    const idx = headers.indexOf(key);
    if (idx > -1) return idx;
  }
  // Teilstring-Treffer (z. B. "betrag (eur)").
  for (const key of keys) {
    const idx = headers.findIndex((h) => h.includes(key));
    if (idx > -1) return idx;
  }
  return -1;
}

/**
 * Parst einen CSV-Kontoauszug. Sucht eine Kopfzeile mit Datum + Betrag und
 * extrahiert alle folgenden Datenzeilen.
 */
export function parseBankCsv(text: string): BankRow[] {
  const rawLines = text
    .split(/\r\n|\r|\n/)
    .map((l) => l)
    .filter((l) => l.trim() !== "");
  if (rawLines.length === 0) return [];

  // Header-Zeile finden: erste Zeile, die sowohl ein Datums- als auch ein
  // Betragsfeld erkennt. Manche Banken haben Vorspann-Zeilen.
  let headerIdx = -1;
  let delim: string = ";";
  let headers: string[] = [];
  let dateCol = -1;
  let descCol = -1;
  let amountCol = -1;

  for (let i = 0; i < Math.min(rawLines.length, 25); i++) {
    const d = detectDelimiter(rawLines[i]);
    const cols = splitCsvLine(rawLines[i], d).map(normalizeHeader);
    const dc = findIndex(cols, DATE_KEYS);
    const ac = findIndex(cols, AMOUNT_KEYS);
    if (dc > -1 && ac > -1) {
      headerIdx = i;
      delim = d;
      headers = cols;
      dateCol = dc;
      amountCol = ac;
      descCol = findIndex(cols, DESC_KEYS);
      break;
    }
  }

  const rows: BankRow[] = [];

  if (headerIdx > -1) {
    for (let i = headerIdx + 1; i < rawLines.length; i++) {
      const cells = splitCsvLine(rawLines[i], delim);
      const date = toIsoDate(cells[dateCol]);
      const amount = parseAmountToCents(cells[amountCol]);
      if (date === null || amount === null) continue;
      const description =
        descCol > -1 ? (cells[descCol] ?? "").trim() : "Bankumsatz";
      rows.push({
        date,
        description: description || "Bankumsatz",
        amountCents: amount,
      });
    }
    if (rows.length > 0) return rows;
  }

  // Fallback: ohne erkannte Kopfzeile — versuche aus jeder Zeile ein Datum und
  // einen Betrag zu extrahieren.
  for (const line of rawLines) {
    const d = detectDelimiter(line);
    const cells = splitCsvLine(line, d);
    let date: string | null = null;
    let amount: number | null = null;
    const textParts: string[] = [];
    for (const cell of cells) {
      const maybeDate = toIsoDate(cell);
      if (date === null && maybeDate) {
        date = maybeDate;
        continue;
      }
      const maybeAmount = parseAmountToCents(cell);
      if (
        amount === null &&
        maybeAmount !== null &&
        /[,.]\d{2}\b|^\s*-?\d+\s*$/.test(cell) &&
        /\d/.test(cell)
      ) {
        amount = maybeAmount;
        continue;
      }
      if (cell.trim()) textParts.push(cell.trim());
    }
    if (date !== null && amount !== null) {
      rows.push({
        date,
        description: textParts.join(" ").slice(0, 200) || "Bankumsatz",
        amountCents: amount,
      });
    }
  }

  return rows;
}
