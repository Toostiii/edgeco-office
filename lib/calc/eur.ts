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

/** Gewinn/Verlust nach EÜR inklusive AfA-Abzug (Cent). */
export function profitAfterDepreciation(
  bookings: Booking[],
  year: number,
  depreciationCents: number,
): number {
  return profit(bookings, year) - Math.max(0, depreciationCents);
}

export interface MonthlySummary {
  month: number;
  income: number;
  expenses: number;
  profit: number;
}

/** Monatliche EÜR-Summen ohne AfA, da AfA jahresbezogen berechnet wird. */
export function monthlySummary(bookings: Booking[], year: number): MonthlySummary[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const monthBookings = bookings.filter((booking) => {
      if (!isActive(booking) || yearOf(booking.date) !== year) return false;
      return Number(booking.date.slice(5, 7)) === month;
    });
    const income = monthBookings
      .filter((booking) => booking.direction === "income")
      .reduce((sum, booking) => sum + booking.amount, 0);
    const expenses = monthBookings
      .filter((booking) => booking.direction === "expense")
      .reduce((sum, booking) => sum + booking.amount, 0);

    return { month, income, expenses, profit: income - expenses };
  });
}
