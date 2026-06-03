import { describe, it, expect } from "vitest";
import { formatEuro, parseEuroToCents } from "./money";

describe("parseEuroToCents", () => {
  it("deutsches Format mit Komma", () => {
    expect(parseEuroToCents("45,00")).toBe(4500);
    expect(parseEuroToCents("1.234,56")).toBe(123456);
  });

  it("Punkt als Dezimaltrenner (einfache Eingabe)", () => {
    expect(parseEuroToCents("82.50")).toBe(8250);
  });

  it("ganze Zahlen", () => {
    expect(parseEuroToCents("120")).toBe(12000);
  });

  it("mit Euro-Zeichen und Leerzeichen", () => {
    expect(parseEuroToCents(" 99,90 € ")).toBe(9990);
  });

  it("wirft bei Unsinn", () => {
    expect(() => parseEuroToCents("abc")).toThrow();
  });
});

describe("formatEuro", () => {
  it("formatiert Cent als deutschen Euro-Betrag", () => {
    expect(formatEuro(123456)).toBe("1.234,56 €");
    expect(formatEuro(0)).toBe("0,00 €");
  });
});
