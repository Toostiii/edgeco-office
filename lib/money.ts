/**
 * Geld-Helfer. Intern wird überall in **Cent (Integer)** gerechnet,
 * nur für die Anzeige in Euro formatiert.
 */

const eurFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

/** Cent → "1.234,56 €" */
export function formatEuro(cents: number): string {
  return eurFormatter.format(cents / 100);
}

/** "1.234,56" oder "1234.56" (Eingabe) → Cent (Integer). */
export function parseEuroToCents(input: string): number {
  const normalized = input
    .trim()
    .replace(/\s|€/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const value = Number(normalized);
  if (Number.isNaN(value)) {
    throw new Error(`Ungültiger Betrag: "${input}"`);
  }
  return Math.round(value * 100);
}
