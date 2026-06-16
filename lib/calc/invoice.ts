/**
 * Rechnungs-Berechnungen. Beträge in Cent (Integer).
 * Kleinunternehmer §19 UStG: keine Umsatzsteuer, daher Summe = Netto = Brutto.
 */

export interface InvoiceLine {
  quantity: number;
  unitPrice: number; // Cent
}

/** Gesamtbetrag = Summe aus Menge × Einzelpreis (Cent). */
export function computeInvoiceTotal(lines: InvoiceLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
}

/** Formatiert eine fortlaufende Nummer als Rechnungsnummer, z. B. "RE-2026-0001". */
export function formatInvoiceNumber(seq: number, year: number): string {
  return `RE-${year}-${String(seq).padStart(4, "0")}`;
}

/** Formatiert eine fortlaufende Nummer als Angebotsnummer, z. B. "AN-2026-0001". */
export function formatQuoteNumber(seq: number, year: number): string {
  return `AN-${year}-${String(seq).padStart(4, "0")}`;
}

/**
 * Addiert N Tage zu einem ISO-Datum (YYYY-MM-DD) und gibt ISO zurück.
 * UTC-basiert, daher keine Zeitzonen-Verschiebung.
 */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
