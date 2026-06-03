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

/**
 * Wandelt eine Eingabe in Cent um — unterstützt deutsches und einfaches Format:
 *   "1.234,56" → 123456   (Punkt = Tausender, Komma = Dezimal)
 *   "82,50"    → 8250
 *   "82.50"    → 8250      (Punkt als Dezimaltrenner, wenn kein Komma da ist)
 *   "1.500"    → 150000    (einzelner Punkt + 3 Stellen = Tausender)
 *   "120"      → 12000
 */
export function parseEuroToCents(input: string): number {
  const cleaned = input.trim().replace(/\s|€/g, "");
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  let normalized: string;
  if (hasComma) {
    // Komma ist der Dezimaltrenner, Punkte sind Tausendertrenner.
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    const parts = cleaned.split(".");
    const lastPart = parts[parts.length - 1];
    // Mehrere Punkte ODER einzelner Punkt mit 3 Nachkommastellen = Tausender.
    if (parts.length > 2 || (parts.length === 2 && lastPart.length === 3)) {
      normalized = cleaned.replace(/\./g, "");
    } else {
      normalized = cleaned; // Punkt ist Dezimaltrenner ("82.50")
    }
  } else {
    normalized = cleaned;
  }

  const value = Number(normalized);
  if (Number.isNaN(value)) {
    throw new Error(`Ungültiger Betrag: "${input}"`);
  }
  return Math.round(value * 100);
}
