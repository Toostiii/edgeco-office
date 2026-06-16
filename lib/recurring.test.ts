import { describe, it, expect } from "vitest";
import { nextDueDate } from "./recurring";

describe("nextDueDate", () => {
  it("wöchentlich: +7 Tage", () => {
    expect(nextDueDate("2026-01-01", "weekly", 1)).toBe("2026-01-08");
  });

  it("monatlich: nächster Monat am dayOfMonth", () => {
    expect(nextDueDate("2026-01-15", "monthly", 15)).toBe("2026-02-15");
  });

  it("monatlich: Dezember → Januar des Folgejahres", () => {
    expect(nextDueDate("2026-12-05", "monthly", 5)).toBe("2027-01-05");
  });

  it("monatlich: dayOfMonth wird auf 1-28 begrenzt", () => {
    expect(nextDueDate("2026-01-31", "monthly", 31)).toBe("2026-02-28");
  });

  it("jährlich: +1 Jahr, gleicher Tag", () => {
    expect(nextDueDate("2026-03-10", "yearly", 10)).toBe("2027-03-10");
  });
});
