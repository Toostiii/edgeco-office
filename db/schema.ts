/**
 * EDGECO Office — Datenbankschema (Drizzle ORM / PostgreSQL).
 *
 * Konventionen:
 * - Geldbeträge in **Cent (integer)** — keine Floats.
 * - GoBD: gebuchte Einträge werden nicht gelöscht, sondern storniert
 *   (status = 'cancelled'). `createdAt` überall.
 * - `ownerId` (Supabase auth.users) für Row-Level-Security (ein Inhaber).
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  date,
  timestamp,
} from "drizzle-orm/pg-core";

export const directionEnum = pgEnum("direction", ["income", "expense"]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "posted",
  "cancelled",
]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "paid",
  "cancelled",
]);
export const depreciationMethodEnum = pgEnum("depreciation_method", ["linear"]);

/** Firmenstammdaten für Rechnungen (i. d. R. genau eine Zeile). */
export const companyProfile = pgTable("company_profile", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id"),
  name: text("name").notNull().default("EDGECO"),
  address: text("address"),
  steuernummer: text("steuernummer"),
  iban: text("iban"),
  logoPath: text("logo_path"),
  nextInvoiceNo: integer("next_invoice_no").notNull().default(1),
  kleinunternehmerHinweis: text("kleinunternehmer_hinweis")
    .notNull()
    .default(
      "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmer).",
    ),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** EÜR-Kategorien (Einnahmen/Ausgaben), z. B. „Material", „Versand". */
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id"),
  name: text("name").notNull(),
  direction: directionEnum("direction").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** Belege (Bild/PDF in Supabase Storage), GoBD-konform mit Hash. */
export const receipts = pgTable("receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id"),
  filePath: text("file_path").notNull(),
  fileHash: text("file_hash"),
  note: text("note"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow(),
});

/** Kunden für Ausgangsrechnungen. */
export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id"),
  name: text("name").notNull(),
  address: text("address"),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** Anlagevermögen (> 800 €) für lineare AfA. */
export const assets = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id"),
  name: text("name").notNull(),
  purchaseDate: date("purchase_date").notNull(),
  /** Anschaffungskosten netto in Cent */
  cost: integer("cost").notNull(),
  usefulLifeYears: integer("useful_life_years").notNull(),
  method: depreciationMethodEnum("method").notNull().default("linear"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** Ausgangsrechnungen (Custom-Parts / Auftragsfertigung). */
export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id"),
  number: text("number").notNull(),
  date: date("date").notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  /** Gesamtbetrag in Cent */
  total: integer("total").notNull().default(0),
  pdfPath: text("pdf_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** Rechnungspositionen. */
export const invoiceItems = pgTable("invoice_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  /** Einzelpreis in Cent */
  unitPrice: integer("unit_price").notNull(),
});

/** EÜR-Buchungen — Herzstück: jede Einnahme und Ausgabe. */
export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id"),
  /** Zufluss-/Abflussdatum */
  date: date("date").notNull(),
  direction: directionEnum("direction").notNull(),
  /** Betrag in Cent, positiv */
  amount: integer("amount").notNull(),
  description: text("description"),
  paymentMethod: text("payment_method"),
  status: bookingStatusEnum("status").notNull().default("posted"),
  categoryId: uuid("category_id").references(() => categories.id),
  receiptId: uuid("receipt_id").references(() => receipts.id),
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  assetId: uuid("asset_id").references(() => assets.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
