import { describe, expect, it } from "vitest";
import {
  isImportableShopifyStatus,
  parseMoneyToCentsOrNull,
  parseShopifyImportText,
  shopifyMarker,
  extractShopifyMarker,
} from "./shopify";

describe("Shopify-Import", () => {
  it("liest typische Shopify-CSV-Zeilen", () => {
    const csv = [
      "Name,Email,Financial Status,Paid at,Total,Billing Name",
      "#1001,kunde@example.de,paid,2026-06-01 10:00:00 +0200,24.99,Max Kunde",
    ].join("\n");

    const result = parseShopifyImportText(csv, "orders.csv");

    expect(result.errors).toEqual([]);
    expect(result.orders).toEqual([
      {
        externalId: "#1001",
        orderName: "#1001",
        date: "2026-06-01",
        amountCents: 2499,
        financialStatus: "paid",
        customerName: "Max Kunde",
        email: "kunde@example.de",
      },
    ]);
  });

  it("liest API-JSON mit current_total_price_set", () => {
    const json = JSON.stringify({
      orders: [
        {
          id: 123,
          name: "#1002",
          created_at: "2026-06-02T12:00:00+02:00",
          financial_status: "paid",
          current_total_price_set: { shop_money: { amount: "1,234.56" } },
          customer: { first_name: "Ada", last_name: "Lovelace" },
        },
      ],
    });

    const result = parseShopifyImportText(json, "orders.json");

    expect(result.errors).toEqual([]);
    expect(result.orders[0]).toMatchObject({
      externalId: "123",
      orderName: "#1002",
      date: "2026-06-02",
      amountCents: 123456,
      customerName: "Ada Lovelace",
    });
  });

  it("dedupliziert mehrzeilige CSV-Bestellungen anhand der Order-ID", () => {
    const csv = [
      "Name,Financial Status,Paid at,Total",
      "#1001,paid,2026-06-01,24.99",
      "#1001,paid,2026-06-01,24.99",
    ].join("\n");

    const result = parseShopifyImportText(csv, "orders.csv");

    expect(result.orders).toHaveLength(1);
  });

  it("parst deutsche und englische Geldformate", () => {
    expect(parseMoneyToCentsOrNull("1.234,56 €")).toBe(123456);
    expect(parseMoneyToCentsOrNull("1,234.56")).toBe(123456);
    expect(parseMoneyToCentsOrNull("24.99")).toBe(2499);
    expect(parseMoneyToCentsOrNull("24,99")).toBe(2499);
  });

  it("markiert importierbare Zahlungsstatus", () => {
    expect(isImportableShopifyStatus("paid")).toBe(true);
    expect(isImportableShopifyStatus("partially_refunded")).toBe(true);
    expect(isImportableShopifyStatus("pending")).toBe(false);
    expect(isImportableShopifyStatus("refunded")).toBe(false);
  });

  it("setzt und liest den Shopify-Dedupe-Marker", () => {
    const description = `Shopify #1001 ${shopifyMarker("gid://shopify/Order/1")}`;
    expect(extractShopifyMarker(description)).toBe("gid://shopify/Order/1");
  });
});
