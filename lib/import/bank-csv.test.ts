import { describe, it, expect } from "vitest";
import { parseBankCsv } from "./bank-csv";

describe("parseBankCsv", () => {
  it("parst ein Sparkassen-Format (Semikolon, deutsches Datum/Betrag)", () => {
    const csv =
      "Buchungstag;Valutadatum;Buchungstext;Verwendungszweck;Betrag;Waehrung\n" +
      "15.01.2026;15.01.2026;Überweisung;Materialkauf Filament;-82,50;EUR\n" +
      "16.01.2026;16.01.2026;Gutschrift;Kundenzahlung RE-2026-0001;150,00;EUR\n";

    const rows = parseBankCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      date: "2026-01-15",
      description: "Materialkauf Filament",
      amountCents: -8250,
    });
    expect(rows[1]).toEqual({
      date: "2026-01-16",
      description: "Kundenzahlung RE-2026-0001",
      amountCents: 15000,
    });
  });

  it("parst ein N26-Format (Komma, ISO-Datum, Punkt-Dezimal)", () => {
    const csv =
      "Date,Payee,Amount,Currency\n" +
      "2026-02-01,Hetzner Online,-9.99,EUR\n" +
      "2026-02-03,Shopify Payout,540.20,EUR\n";

    const rows = parseBankCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      date: "2026-02-01",
      description: "Hetzner Online",
      amountCents: -999,
    });
    expect(rows[1].amountCents).toBe(54020);
  });

  it("ignoriert Zeilen ohne erkennbares Datum oder Betrag", () => {
    const csv =
      "Buchungstag;Verwendungszweck;Betrag\n" +
      "15.01.2026;Gueltige Zeile;-10,00\n" +
      ";Kaputte Zeile ohne Datum;\n";

    const rows = parseBankCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].amountCents).toBe(-1000);
  });

  it("liefert leeres Array für leeren Text", () => {
    expect(parseBankCsv("")).toEqual([]);
  });
});
