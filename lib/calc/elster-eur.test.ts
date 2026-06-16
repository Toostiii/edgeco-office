import { describe, it, expect } from "vitest";
import { buildElsterSummary } from "./elster-eur";

describe("buildElsterSummary", () => {
  it("gruppiert Buchungen nach Kennzahl und summiert je Zeile", () => {
    const result = buildElsterSummary(
      [
        { direction: "income", amount: 10000, categoryKennzahl: "111" },
        { direction: "income", amount: 5000, categoryKennzahl: "111" },
        { direction: "expense", amount: 2000, categoryKennzahl: "100" },
        { direction: "expense", amount: 500, categoryKennzahl: "227" },
      ],
      0,
    );

    expect(result.lines).toEqual([
      { kennzahl: expect.objectContaining({ code: "111", zeile: 12 }), amountCents: 15000 },
      { kennzahl: expect.objectContaining({ code: "100", zeile: 27 }), amountCents: 2000 },
      { kennzahl: expect.objectContaining({ code: "227", zeile: 53 }), amountCents: 500 },
    ]);
    expect(result.unmappedIncomeCents).toBe(0);
    expect(result.unmappedExpenseCents).toBe(0);
  });

  it("sammelt Buchungen ohne Kennzahl getrennt nach Richtung", () => {
    const result = buildElsterSummary(
      [
        { direction: "income", amount: 1000, categoryKennzahl: null },
        { direction: "expense", amount: 300, categoryKennzahl: "unknown-code" },
      ],
      0,
    );

    expect(result.lines).toEqual([]);
    expect(result.unmappedIncomeCents).toBe(1000);
    expect(result.unmappedExpenseCents).toBe(300);
  });

  it("addiert die AfA aus dem Anlagenverzeichnis zu Kennzahl 130 (Zeile 33)", () => {
    const result = buildElsterSummary(
      [{ direction: "expense", amount: 1000, categoryKennzahl: "130" }],
      5000,
    );

    const line130 = result.lines.find((l) => l.kennzahl.code === "130");
    expect(line130?.amountCents).toBe(6000);
  });

  it("zeigt Zeile 33 auch ohne gebuchte AfA-Kategorie, wenn Anlagen abgeschrieben werden", () => {
    const result = buildElsterSummary([], 4200);
    expect(result.lines).toEqual([
      { kennzahl: expect.objectContaining({ code: "130", zeile: 33 }), amountCents: 4200 },
    ]);
  });

  it("sortiert Zeilen nach Formular-Reihenfolge, nicht nach Eingabereihenfolge", () => {
    const result = buildElsterSummary(
      [
        { direction: "expense", amount: 100, categoryKennzahl: "227" }, // Zeile 53
        { direction: "expense", amount: 100, categoryKennzahl: "100" }, // Zeile 27
      ],
      0,
    );
    expect(result.lines.map((l) => l.kennzahl.zeile)).toEqual([27, 53]);
  });
});
