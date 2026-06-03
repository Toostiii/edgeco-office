/**
 * EÜR-Kernlogik (Einnahmen-Überschuss-Rechnung, §4 Abs. 3 EStG).
 *
 * Kleinunternehmer §19 UStG: keine Umsatzsteuer, reines Zufluss-/Abfluss-Prinzip.
 * Alle Beträge in **Cent (Integer)**, um Float-Rundungsfehler bei Geld zu vermeiden.
 */

export type Direction = "income" | "expense";
export type BookingStatus = "posted" | "cancelled";

export interface Booking {
  /** Zufluss-/Abflussdatum im Format yyyy-mm-dd */
  date: string;
  direction: Direction;
  /** Betrag in Cent, positiv */
  amount: number;
  /** Stornierte Buchungen zählen nicht (GoBD: nicht löschen, sondern stornieren) */
  status?: BookingStatus;
}

function yearOf(isoDate: string): number {
  return Number(isoDate.slice(0, 4));
}

function isActive(b: Booking): boolean {
  return b.status !== "cancelled";
}

/** Summe aller aktiven Buchungen einer Richtung im angegebenen Jahr (Cent). */
export function sumByDirection(
  bookings: Booking[],
  direction: Direction,
  year: number,
): number {
  return bookings
    .filter(
      (b) => isActive(b) && b.direction === direction && yearOf(b.date) === year,
    )
    .reduce((sum, b) => sum + b.amount, 0);
}

export function totalIncome(bookings: Booking[], year: number): number {
  return sumByDirection(bookings, "income", year);
}

export function totalExpenses(bookings: Booking[], year: number): number {
  return sumByDirection(bookings, "expense", year);
}

/** Gewinn/Verlust nach EÜR: Einnahmen − Ausgaben (Cent). */
export function profit(bookings: Booking[], year: number): number {
  return totalIncome(bookings, year) - totalExpenses(bookings, year);
}
