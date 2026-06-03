/**
 * Voll-Backup: lädt alle Daten des Inhabers als JSON-Datei herunter.
 * Eigene Auth-Prüfung (Route Handler sind nicht vom (app)-Layout geschützt).
 * Belege-Dateien liegen in Supabase Storage — hier nur deren Metadaten.
 */
import { eq, inArray, or, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  transactions,
  invoices,
  invoiceItems,
  customers,
  assets,
  categories,
  companyProfile,
  receipts,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Nicht angemeldet.", { status: 401 });

  const uid = user.id;

  const [
    transactionRows,
    invoiceRows,
    customerRows,
    assetRows,
    categoryRows,
    profileRows,
    receiptRows,
  ] = await Promise.all([
    db.select().from(transactions).where(eq(transactions.ownerId, uid)),
    db.select().from(invoices).where(eq(invoices.ownerId, uid)),
    db.select().from(customers).where(eq(customers.ownerId, uid)),
    db.select().from(assets).where(eq(assets.ownerId, uid)),
    db
      .select()
      .from(categories)
      .where(or(eq(categories.ownerId, uid), isNull(categories.ownerId))),
    db.select().from(companyProfile),
    db.select().from(receipts).where(eq(receipts.ownerId, uid)),
  ]);

  const invoiceIds = invoiceRows.map((i) => i.id);
  const itemRows =
    invoiceIds.length > 0
      ? await db
          .select()
          .from(invoiceItems)
          .where(inArray(invoiceItems.invoiceId, invoiceIds))
      : [];

  const backup = {
    meta: {
      app: "EDGECO Office",
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      note: "Belege-Dateien liegen in Supabase Storage (Bucket 'belege') und sind hier nur als Metadaten enthalten.",
    },
    companyProfile: profileRows,
    categories: categoryRows,
    customers: customerRows,
    assets: assetRows,
    invoices: invoiceRows,
    invoiceItems: itemRows,
    transactions: transactionRows,
    receipts: receiptRows,
  };

  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="edgeco-backup-${date}.json"`,
    },
  });
}
