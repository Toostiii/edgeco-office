import { describe, it, expect } from "vitest";
import { generateZugferdXml } from "./zugferd";

describe("generateZugferdXml", () => {
  const base = {
    invoiceNumber: "RE-2026-0001",
    invoiceDate: "2026-06-15",
    sellerName: "EDGECO",
    steuernummer: "12/345/67890",
    buyerName: "Max Mustermann",
    totalCents: 15050,
  };

  it("enthält Rechnungsnummer, Datum und Gesamtbetrag", () => {
    const xml = generateZugferdXml(base);
    expect(xml).toContain("<ram:ID>RE-2026-0001</ram:ID>");
    expect(xml).toContain('format="102">20260615<');
    expect(xml).toContain("<ram:GrandTotalAmount>150.50</ram:GrandTotalAmount>");
    expect(xml).toContain("<ram:TaxTotalAmount currencyID=\"EUR\">0.00</ram:TaxTotalAmount>");
  });

  it("bettet das Fälligkeitsdatum als DueDateDateTime ein, wenn vorhanden", () => {
    const xml = generateZugferdXml({ ...base, dueDate: "2026-06-29" });
    expect(xml).toContain("<ram:SpecifiedTradePaymentTerms>");
    expect(xml).toContain('format="102">20260629<');
  });

  it("lässt SpecifiedTradePaymentTerms weg, wenn kein Fälligkeitsdatum gesetzt ist", () => {
    const xml = generateZugferdXml(base);
    expect(xml).not.toContain("<ram:SpecifiedTradePaymentTerms>");
  });

  it("escaped XML-Sonderzeichen in Namen", () => {
    const xml = generateZugferdXml({ ...base, buyerName: 'Müller & Co. "GmbH"' });
    expect(xml).toContain("Müller &amp; Co. &quot;GmbH&quot;");
  });
});
