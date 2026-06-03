import { describe, it, expect } from "vitest";
import { computeInvoiceTotal, type InvoiceLine } from "./invoice";

describe("Rechnungssumme", () => {
  it("leere Rechnung = 0", () => {
    expect(computeInvoiceTotal([])).toBe(0);
  });

  it("eine Position: Menge × Einzelpreis", () => {
    const lines: InvoiceLine[] = [{ quantity: 2, unitPrice: 4500 }];
    expect(computeInvoiceTotal(lines)).toBe(9000); // 2 × 45,00 €
  });

  it("mehrere Positionen", () => {
    const lines: InvoiceLine[] = [
      { quantity: 1, unitPrice: 12000 }, // 120,00
      { quantity: 3, unitPrice: 500 }, // 3 × 5,00 = 15,00
    ];
    expect(computeInvoiceTotal(lines)).toBe(13500); // 135,00 €
  });
});
