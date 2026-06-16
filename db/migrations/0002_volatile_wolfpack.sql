CREATE TYPE "public"."frequency" AS ENUM('monthly', 'weekly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'accepted', 'rejected', 'converted');--> statement-breakpoint
CREATE TYPE "public"."time_entry_status" AS ENUM('open', 'invoiced');--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"number" text NOT NULL,
	"date" date NOT NULL,
	"valid_until" date,
	"customer_id" uuid,
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"invoice_id" uuid,
	"pdf_path" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recurring_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"direction" "direction" NOT NULL,
	"amount" integer NOT NULL,
	"category_id" uuid,
	"description" text NOT NULL,
	"payment_method" text,
	"frequency" "frequency" DEFAULT 'monthly' NOT NULL,
	"day_of_month" integer DEFAULT 1,
	"next_due" date NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"date" date NOT NULL,
	"customer_id" uuid,
	"description" text NOT NULL,
	"minutes" integer NOT NULL,
	"hourly_rate_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"status" time_entry_status DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "travel_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"date" date NOT NULL,
	"purpose" text NOT NULL,
	"distance_km" integer NOT NULL,
	"rate_per_km_cents" integer DEFAULT 30 NOT NULL,
	"total_cents" integer NOT NULL,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "company_profile" ADD COLUMN "next_quote_no" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "company_profile" ADD COLUMN "payment_terms_days" integer DEFAULT 14;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "dunning_level" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "dunning_date" date;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "split_group_id" uuid;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_expenses" ADD CONSTRAINT "travel_expenses_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;