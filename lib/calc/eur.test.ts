import { describe, it, expect } from "vitest";
import { totalIncome, totalExpenses, profit, type Booking } from "./eur";

// Alle Beträge in Cent (Integer), um Float-Rundungsfehler bei Geld zu vermeiden.
const bookings: Booking[] = [
  { date: "2026-01-10", direction: "income", amount: 4500 }, // 45,00 €
  { date: "2026-02-03", direction: "income", amount: 12000 }, // 120,00 €
  { date: "2026-02-05", direction: "expense", amount: 8200 }, // 82,00 €
  { date: "2026-03-01", direction: "expense", amount: 1500, status: "cancelled" }, // storniert
  { date: "2025-12-30", direction: "income", amount: 9999 }, // anderes Jahr
];

describe("EÜR-Summen", () => {
  it("summiert nur Einnahmen des Jahres (Zuflussprinzip)", () => {
    expect(totalIncome(bookings, 2026)).toBe(16500); // 45 + 120
  });

  it("summiert nur Ausgaben des Jahres", () => {
    expect(totalExpenses(bookings, 2026)).toBe(8200); // 82
  });

  it("ignoriert stornierte Buchungen", () => {
    // die stornierte 15,00-€-Ausgabe darf nicht zählen
    expect(totalExpenses(bookings, 2026)).toBe(8200);
  });

  it("berücksichtigt nur das angefragte Jahr", () => {
    expect(totalIncome(bookings, 2025)).toBe(9999);
  });

  it("Gewinn = Einnahmen − Ausgaben (EÜR)", () => {
    expect(profit(bookings, 2026)).toBe(8300); // 16500 − 8200
  });

  it("leere Liste ergibt 0", () => {
    expect(profit([], 2026)).toBe(0);
  });
});
