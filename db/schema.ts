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
  boolean,
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
export const quoteStatusEnum = pgEnum("quote_status", [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "converted",
]);
export const frequencyEnum = pgEnum("frequency", [
  "monthly",
  "weekly",
  "yearly",
]);
export const timeEntryStatusEnum = pgEnum("time_entry_status", [
  "open",
  "invoiced",
]);

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
  nextQuoteNo: integer("next_quote_no").default(1),
  /** Standard-Zahlungsziel in Tagen (für neue Rechnungen). */
  paymentTermsDays: integer("payment_terms_days").default(14),
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
  /** Fälligkeitsdatum (Zahlungsziel), nullable. */
  dueDate: date("due_date"),
  customerId: uuid("customer_id").references(() => customers.id),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  /** Gesamtbetrag in Cent */
  total: integer("total").notNull().default(0),
  /** Mahnstufe: 0 = keine, 1 = 1. Mahnung, 2 = 2. Mahnung. */
  dunningLevel: integer("dunning_level").default(0),
  /** Datum der letzten Mahnung, nullable. */
  dunningDate: date("dunning_date"),
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
  /** Gruppen-ID für Splitbuchungen (mehrere Zeilen einer Buchung). */
  splitGroupId: uuid("split_group_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** GoBD-Festschreibung: gesperrte Geschäftsjahre (keine Änderungen mehr). */
export const fiscalLocks = pgTable("fiscal_locks", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id"),
  year: integer("year").notNull(),
  lockedAt: timestamp("locked_at", { withTimezone: true }).defaultNow(),
});

/** Angebote (Quotes) — können in Rechnungen umgewandelt werden. */
export const quotes = pgTable("quotes", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id"),
  number: text("number").notNull(), // "AN-2026-0001"
  date: date("date").notNull(),
  validUntil: date("valid_until"),
  customerId: uuid("customer_id").references(() => customers.id),
  status: quoteStatusEnum("status").notNull().default("draft"),
  total: integer("total").notNull().default(0),
  notes: text("notes"),
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  pdfPath: text("pdf_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** Angebotspositionen. */
export const quoteItems = pgTable("quote_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  quoteId: uuid("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unit_price").notNull(),
});

/** Wiederkehrende Buchungen (Vorlagen für regelmäßige Einnahmen/Ausgaben). */
export const recurringTransactions = pgTable("recurring_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id"),
  direction: directionEnum("direction").notNull(),
  amount: integer("amount").notNull(), // Cent
  categoryId: uuid("category_id").references(() => categories.id),
  description: text("description").notNull(),
  paymentMethod: text("payment_method"),
  frequency: frequencyEnum("frequency").notNull().default("monthly"),
  dayOfMonth: integer("day_of_month").default(1), // 1-28
  nextDue: date("next_due").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** Reisekosten (Kilometerpauschale). */
export const travelExpenses = pgTable("travel_expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id"),
  date: date("date").notNull(),
  purpose: text("purpose").notNull(),
  distanceKm: integer("distance_km").notNull(), // ganze km
  ratePerKmCents: integer("rate_per_km_cents").notNull().default(30), // 30 = 0,30 €/km
  totalCents: integer("total_cents").notNull(), // distanceKm * ratePerKmCents
  transactionId: uuid("transaction_id").references(() => transactions.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** Zeiterfassung — abrechenbare Arbeitszeit pro Kunde. */
export const timeEntries = pgTable("time_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id"),
  date: date("date").notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  description: text("description").notNull(),
  minutes: integer("minutes").notNull(), // Minuten (z.B. 90 = 1,5h)
  hourlyRateCents: integer("hourly_rate_cents").notNull(), // z.B. 8000 = 80,00 €/h
  totalCents: integer("total_cents").notNull(), // minutes/60 * hourlyRateCents (gerundet)
  status: timeEntryStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
