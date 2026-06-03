import { describe, it, expect } from "vitest";
import { parseReceiptText } from "./parse-receipt";

describe("parseReceiptText", () => {
  it("erkennt Betrag (Summe) und Datum", () => {
    const text = `Tankstelle Mustermann
Diesel 45,00
MwSt 19% 7,18
Summe 45,00 EUR
Datum: 03.06.2026`;
    const r = parseReceiptText(text);
    expect(r.amountCents).toBe(4500);
    expect(r.date).toBe("2026-06-03");
  });

  it("bevorzugt den Betrag auf der Gesamt-Zeile (nicht den größten Einzelposten)", () => {
    const text = `Artikel A 30,00
Artikel B 50,00
Gesamt 80,00`;
    const r = parseReceiptText(text);
    expect(r.amountCents).toBe(8000);
  });

  it("versteht Tausendertrenner", () => {
    const text = `Gesamtbetrag 1.234,56 EUR\n12.05.2026`;
    const r = parseReceiptText(text);
    expect(r.amountCents).toBe(123456);
    expect(r.date).toBe("2026-05-12");
  });

  it("normalisiert zweistellige Jahreszahl", () => {
    const r = parseReceiptText("Summe 9,99\n03.06.26");
    expect(r.date).toBe("2026-06-03");
  });

  it("nimmt ohne Schlüsselwort den größten Betrag", () => {
    const r = parseReceiptText("3,00\n19,90\n5,50");
    expect(r.amountCents).toBe(1990);
  });

  it("gibt null zurück, wenn nichts gefunden wird", () => {
    const r = parseReceiptText("kein betrag hier");
    expect(r.amountCents).toBeNull();
    expect(r.date).toBeNull();
  });

  it("ignoriert ungültige Datumswerte", () => {
    const r = parseReceiptText("Summe 5,00\n45.13.2026");
    expect(r.date).toBeNull();
  });
});
