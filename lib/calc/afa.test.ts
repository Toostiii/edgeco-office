import { describe, it, expect } from "vitest";
import {
  depreciationForYear,
  depreciationSchedule,
  type Asset,
} from "./afa";

// Lineare AfA, monatsgenau (pro rata temporis). Beträge in Cent.

describe("Lineare AfA — Anschaffung im Januar", () => {
  const drucker: Asset = {
    purchaseDate: "2024-01-15",
    cost: 150000, // 1.500,00 €
    usefulLifeYears: 3,
  };

  it("schreibt im ersten vollen Jahr cost/Jahre ab", () => {
    expect(depreciationForYear(drucker, 2024)).toBe(50000);
    expect(depreciationForYear(drucker, 2025)).toBe(50000);
    expect(depreciationForYear(drucker, 2026)).toBe(50000);
  });

  it("nach Ende der Nutzungsdauer 0", () => {
    expect(depreciationForYear(drucker, 2027)).toBe(0);
    expect(depreciationForYear(drucker, 2023)).toBe(0);
  });

  it("Summe des Plans entspricht exakt den Anschaffungskosten", () => {
    const sum = depreciationSchedule(drucker).reduce((a, e) => a + e.amount, 0);
    expect(sum).toBe(150000);
  });
});

describe("Lineare AfA — unterjährige Anschaffung (Juli)", () => {
  // 1.200 € im Juli, 3 Jahre. Erstes Jahr nur 6 Monate (Jul–Dez).
  const asset: Asset = {
    purchaseDate: "2024-07-01",
    cost: 120000,
    usefulLifeYears: 3,
  };

  it("erstes Jahr anteilig (6/12)", () => {
    expect(depreciationForYear(asset, 2024)).toBe(20000); // 40000 * 6/12
  });

  it("volle Zwischenjahre", () => {
    expect(depreciationForYear(asset, 2025)).toBe(40000);
    expect(depreciationForYear(asset, 2026)).toBe(40000);
  });

  it("letztes (Rest-)Jahr absorbiert den Rest", () => {
    expect(depreciationForYear(asset, 2027)).toBe(20000);
  });

  it("Plan summiert sich exakt auf die Kosten", () => {
    const sum = depreciationSchedule(asset).reduce((a, e) => a + e.amount, 0);
    expect(sum).toBe(120000);
  });

  it("Restbuchwert sinkt monoton bis 0", () => {
    const plan = depreciationSchedule(asset);
    expect(plan[plan.length - 1].bookValueEnd).toBe(0);
  });
});
