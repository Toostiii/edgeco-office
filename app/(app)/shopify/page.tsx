/**
 * Shopify-Import — Bestellungen als EÜR-Einnahmen übernehmen.
 */
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import ShopifyImportForm from "@/components/ShopifyImportForm";
import { formatEuro } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ShopifyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const recent = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      amount: transactions.amount,
      description: transactions.description,
    })
    .from(transactions)
    .where(eq(transactions.ownerId, user.id))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(200);

  const shopifyRows = recent
    .filter((row) => row.description?.includes("[shopify:"))
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-1 text-2xl font-bold">Shopify-Import</h1>
      <p className="mb-6 text-sm text-muted">
        Bestellungen prüfen und als Einnahmen buchen.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <ShopifyImportForm />

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Zuletzt importiert</h2>
          {shopifyRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              Noch keine Shopify-Buchungen.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {shopifyRows.map((row) => (
                <li key={row.id} className="py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {cleanDescription(row.description)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">{row.date}</p>
                    </div>
                    <span className="whitespace-nowrap text-income">
                      {formatEuro(row.amount)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function cleanDescription(description: string | null): string {
  return description?.replace(/\s*\[shopify:[^\]]+\]/, "") ?? "Shopify";
}
