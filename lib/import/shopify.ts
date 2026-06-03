/**
 * Shopify-Import: CSV/API-JSON in EÜR-fähige Bestellungen normalisieren.
 * Alle Beträge werden als Cent-Integer ausgegeben.
 */

export type ShopifyImportOrder = {
  externalId: string;
  orderName: string;
  date: string;
  amountCents: number;
  financialStatus: string | null;
  customerName: string | null;
  email: string | null;
};

export type ShopifyParseResult = {
  orders: ShopifyImportOrder[];
  errors: string[];
};

const FIELD_ALIASES = {
  id: ["id", "order id", "order_id"],
  name: ["name", "order", "order name", "order number", "order_number"],
  date: [
    "paid at",
    "created at",
    "processed at",
    "date",
    "created_at",
    "processed_at",
  ],
  total: [
    "current total price",
    "current_total_price",
    "total price",
    "total_price",
    "total",
    "amount",
    "betrag",
  ],
  status: ["financial status", "financial_status", "payment status", "status"],
  customer: ["billing name", "customer", "customer name", "name customer"],
  firstName: ["billing first name", "first name", "customer first name"],
  lastName: ["billing last name", "last name", "customer last name"],
  email: ["email", "customer email", "billing email"],
};

export function shopifyMarker(externalId: string): string {
  return `[shopify:${externalId}]`;
}

export function extractShopifyMarker(description: string | null): string | null {
  if (!description) return null;
  return description.match(/\[shopify:([^\]]+)\]/)?.[1] ?? null;
}

export function isImportableShopifyStatus(status: string | null): boolean {
  if (!status) return true;
  const normalized = normalizeStatus(status);
  return ["paid", "partially paid", "partially refunded"].includes(normalized);
}

export function parseShopifyImportText(
  text: string,
  filename = "",
): ShopifyParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { orders: [], errors: ["Die Importdatei ist leer."] };

  if (filename.toLowerCase().endsWith(".json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseShopifyJson(trimmed);
  }

  return parseShopifyCsv(trimmed);
}

function parseShopifyJson(text: string): ShopifyParseResult {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return { orders: [], errors: ["JSON konnte nicht gelesen werden."] };
  }

  const records = jsonRecords(payload);
  if (records.length === 0) {
    return { orders: [], errors: ["Keine Shopify-Bestellungen im JSON gefunden."] };
  }

  const errors: string[] = [];
  const orders = records.flatMap((record, index) => {
    const order = normalizeJsonOrder(record, index + 1);
    if ("error" in order) {
      errors.push(order.error);
      return [];
    }
    return [order.data];
  });

  return { orders: dedupeOrders(orders), errors };
}

function parseShopifyCsv(text: string): ShopifyParseResult {
  const rows = parseCsvRows(text);
  if (rows.length < 2) {
    return { orders: [], errors: ["CSV enthält keine Bestellzeilen."] };
  }

  const headers = rows[0].map(normalizeHeader);
  const errors: string[] = [];
  const orders = rows.slice(1).flatMap((cells, index) => {
    if (cells.every((cell) => cell.trim() === "")) return [];
    const row = toRecord(headers, cells);
    const order = normalizeCsvOrder(row, index + 2);
    if ("error" in order) {
      errors.push(order.error);
      return [];
    }
    return [order.data];
  });

  return { orders: dedupeOrders(orders), errors };
}

function normalizeJsonOrder(
  record: unknown,
  position: number,
): { data: ShopifyImportOrder } | { error: string } {
  if (!isRecord(record)) {
    return { error: `JSON-Bestellung ${position}: ungültiger Datensatz.` };
  }

  const id =
    stringValue(record.admin_graphql_api_id) ||
    stringValue(record.id) ||
    stringValue(record.order_id) ||
    stringValue(record.name) ||
    stringValue(record.order_number);
  const orderName =
    stringValue(record.name) ||
    (stringValue(record.order_number) ? `#${stringValue(record.order_number)}` : id);
  const date =
    toIsoDate(stringValue(record.processed_at)) ||
    toIsoDate(stringValue(record.created_at)) ||
    toIsoDate(stringValue(record.date));
  const amount =
    moneyFromShopifySet(record.current_total_price_set) ??
    parseMoneyToCentsOrNull(stringValue(record.current_total_price)) ??
    moneyFromShopifySet(record.total_price_set) ??
    parseMoneyToCentsOrNull(stringValue(record.total_price));

  if (!id || !orderName) {
    return { error: `JSON-Bestellung ${position}: Bestellnummer fehlt.` };
  }
  if (!date) return { error: `JSON-Bestellung ${position}: Datum fehlt.` };
  if (!amount || amount <= 0) {
    return { error: `JSON-Bestellung ${position}: positiver Betrag fehlt.` };
  }

  const customer = isRecord(record.customer) ? record.customer : null;
  const customerName = customer
    ? [stringValue(customer.first_name), stringValue(customer.last_name)]
        .filter(Boolean)
        .join(" ")
        .trim() || null
    : null;

  return {
    data: {
      externalId: id,
      orderName,
      date,
      amountCents: amount,
      financialStatus: stringValue(record.financial_status),
      customerName,
      email: stringValue(record.email) || (customer ? stringValue(customer.email) : null),
    },
  };
}

function normalizeCsvOrder(
  row: Record<string, string>,
  line: number,
): { data: ShopifyImportOrder } | { error: string } {
  const id = firstField(row, FIELD_ALIASES.id);
  const orderName = firstField(row, FIELD_ALIASES.name) || id;
  const externalId = id || orderName;
  const date = toIsoDate(firstField(row, FIELD_ALIASES.date));
  const amount = parseMoneyToCentsOrNull(firstField(row, FIELD_ALIASES.total));

  if (!externalId || !orderName) {
    return { error: `CSV-Zeile ${line}: Bestellnummer fehlt.` };
  }
  if (!date) return { error: `CSV-Zeile ${line}: Datum fehlt.` };
  if (!amount || amount <= 0) {
    return { error: `CSV-Zeile ${line}: positiver Betrag fehlt.` };
  }

  const customerName =
    firstField(row, FIELD_ALIASES.customer) ||
    [firstField(row, FIELD_ALIASES.firstName), firstField(row, FIELD_ALIASES.lastName)]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    null;

  return {
    data: {
      externalId,
      orderName,
      date,
      amountCents: amount,
      financialStatus: firstField(row, FIELD_ALIASES.status) || null,
      customerName,
      email: firstField(row, FIELD_ALIASES.email) || null,
    },
  };
}

function jsonRecords(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  if (Array.isArray(payload.orders)) return payload.orders;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function moneyFromShopifySet(value: unknown): number | null {
  if (!isRecord(value)) return null;
  const shopMoney = isRecord(value.shop_money) ? value.shop_money : null;
  const presentmentMoney = isRecord(value.presentment_money)
    ? value.presentment_money
    : null;
  return (
    parseMoneyToCentsOrNull(shopMoney ? stringValue(shopMoney.amount) : null) ??
    parseMoneyToCentsOrNull(
      presentmentMoney ? stringValue(presentmentMoney.amount) : null,
    )
  );
}

export function parseMoneyToCentsOrNull(input: string | null): number | null {
  if (!input) return null;
  const cleaned = input
    .trim()
    .replace(/\s/g, "")
    .replace(/[€$£A-Z]{1,4}/gi, "");
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimalSeparator =
    lastComma > -1 && lastDot > -1
      ? lastComma > lastDot
        ? ","
        : "."
      : lastComma > -1
        ? ","
        : lastDot > -1 && cleaned.length - lastDot - 1 <= 2
          ? "."
          : null;

  let normalized: string;
  if (decimalSeparator === ",") {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (decimalSeparator === ".") {
    normalized = cleaned.replace(/,/g, "");
  } else {
    normalized = cleaned.replace(/[.,]/g, "");
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function toRecord(headers: string[], cells: string[]): Record<string, string> {
  return headers.reduce<Record<string, string>>((record, header, index) => {
    record[header] = cells[index]?.trim() ?? "";
    return record;
  }, {});
}

function dedupeOrders(orders: ShopifyImportOrder[]): ShopifyImportOrder[] {
  const seen = new Set<string>();
  return orders.filter((order) => {
    if (seen.has(order.externalId)) return false;
    seen.add(order.externalId);
    return true;
  });
}

function firstField(row: Record<string, string>, aliases: string[]): string | null {
  for (const alias of aliases) {
    const value = row[normalizeHeader(alias)];
    if (value) return value;
  }
  return null;
}

function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeStatus(status: string): string {
  return normalizeHeader(status).replace(/\s+/g, " ");
}

function toIsoDate(input: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const german = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (german) return `${german[3]}-${german[2]}-${german[1]}`;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
