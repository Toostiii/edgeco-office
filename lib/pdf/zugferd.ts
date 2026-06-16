/**
 * Erzeugt das Factur-X MINIMUM XML für §19-UStG-Rechnungen.
 *
 * Factur-X MINIMUM ist das einfachste maschinenlesbare E-Rechnungsformat,
 * das von der EU-Richtlinie 2014/55/EU (EN16931-konform) sowie dem deutschen
 * Wachstumschancengesetz (§ 14 UStG ab 2025) anerkannt wird.
 *
 * Für Kleinunternehmer (§ 19 UStG): TaxTotal = 0, CategoryCode E (Exempt).
 * Beträge werden aus Cent (Integer) in "12345.67"-Notation umgerechnet.
 */

export interface ZugferdData {
  invoiceNumber: string;
  invoiceDate: string; // ISO "YYYY-MM-DD"
  sellerName: string;
  sellerCountry?: string; // Default "DE"
  steuernummer: string | null;
  buyerName: string;
  totalCents: number; // Gesamtbetrag in Cent
  dueDate?: string | null; // ISO "YYYY-MM-DD", Fälligkeitsdatum
}

function xe(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function compact(iso: string): string {
  return iso.replace(/-/g, ""); // "2026-06-15" → "20260615"
}

function euro(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function generateZugferdXml(d: ZugferdData): string {
  const total = euro(d.totalCents);
  const country = xe(d.sellerCountry ?? "DE");
  const dateStr = compact(d.invoiceDate);

  const paymentTerms = d.dueDate
    ? `<ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${compact(d.dueDate)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>`
    : "";

  const taxReg = d.steuernummer
    ? `<ram:SpecifiedTaxRegistration>
        <ram:ID schemeID="FC">${xe(d.steuernummer)}</ram:ID>
      </ram:SpecifiedTaxRegistration>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">

  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:minimum</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <rsm:ExchangedDocument>
    <ram:ID>${xe(d.invoiceNumber)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${dateStr}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${xe(d.sellerName)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:CountryID>${country}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${taxReg}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${xe(d.buyerName)}</ram:Name>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${dateStr}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>

    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      ${paymentTerms}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:TaxBasisTotalAmount>${total}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">0.00</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${total}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${total}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}
