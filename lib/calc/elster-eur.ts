/**
 * Gruppiert Buchungen anhand der Kategorie-Kennzahl in die Struktur der
 * "Anlage EÜR". AfA fließt nicht aus Buchungen, sondern aus dem
 * Anlagenverzeichnis ein (kanonische Quelle für Zeile 33 / Kennzahl 130).
 */
import { ELSTER_KENNZAHLEN, findKennzahl, type ElsterKennzahl } from "@/lib/elster";

export interface ElsterBooking {
  direction: "income" | "expense";
  amount: number; // Cent
  categoryKennzahl: string | null;
}

export interface ElsterLine {
  kennzahl: ElsterKennzahl;
  amountCents: number;
}

export interface ElsterSummary {
  lines: ElsterLine[];
  unmappedIncomeCents: number;
  unmappedExpenseCents: number;
}

export function buildElsterSummary(
  rows: ElsterBooking[],
  afaTotalCents: number,
): ElsterSummary {
  const totals = new Map<string, number>();
  let unmappedIncomeCents = 0;
  let unmappedExpenseCents = 0;

  for (const row of rows) {
    const kz = findKennzahl(row.categoryKennzahl);
    if (!kz) {
      if (row.direction === "income") unmappedIncomeCents += row.amount;
      else unmappedExpenseCents += row.amount;
      continue;
    }
    totals.set(kz.code, (totals.get(kz.code) ?? 0) + row.amount);
  }

  if (afaTotalCents > 0) {
    totals.set("130", (totals.get("130") ?? 0) + afaTotalCents);
  }

  const lines: ElsterLine[] = ELSTER_KENNZAHLEN.filter((k) => totals.has(k.code))
    .map((k) => ({ kennzahl: k, amountCents: totals.get(k.code)! }))
    .sort((a, b) => a.kennzahl.zeile - b.kennzahl.zeile);

  return { lines, unmappedIncomeCents, unmappedExpenseCents };
}
