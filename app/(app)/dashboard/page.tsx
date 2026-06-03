/**
 * Dashboard — EÜR-Überblick des laufenden Jahres.
 * Liest Buchungen aus der DB und rechnet über lib/calc/eur.
 */
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { assets, transactions } from "@/db/schema";
import { depreciationForYear } from "@/lib/calc/afa";
import {
  totalIncome,
  totalExpenses,
  profitAfterDepreciation,
  type Booking,
} from "@/lib/calc/eur";
import { formatEuro } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const year = new Date().getFullYear();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [rows, assetRows] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(eq(transactions.ownerId, user.id))
      .orderBy(desc(transactions.date))
      .limit(200),
    db
      .select()
      .from(assets)
      .where(eq(assets.ownerId, user.id))
      .limit(500),
  ]);

  const bookings: Booking[] = rows.map((r) => ({
    date: r.date,
    direction: r.direction,
    amount: r.amount,
    status: r.status,
  }));

  const income = totalIncome(bookings, year);
  const expenses = totalExpenses(bookings, year);
  const depreciation = assetRows.reduce(
    (sum, asset) => sum + depreciationForYear(asset, year),
    0,
  );
  const gewinn = profitAfterDepreciation(bookings, year, depreciation);
  const recent = rows.slice(0, 5);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold">Dashboard</h1>
      <p className="mb-6 text-sm text-muted">Geschäftsjahr {year}</p>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={`Einnahmen ${year}`} value={formatEuro(income)} accent="income" />
        <KpiCard label={`Ausgaben ${year}`} value={formatEuro(expenses)} accent="expense" />
        <KpiCard label={`AfA ${year}`} value={formatEuro(depreciation)} accent="expense" />
        <KpiCard label="Gewinn (EÜR inkl. AfA)" value={formatEuro(gewinn)} />
      </div>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Letzte Buchungen</h2>
        {recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            Noch keine Buchungen. In Phase 1 kannst du hier Einnahmen und
            Ausgaben erfassen.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((r) => (
              <li key={r.id} className="flex justify-between py-2 text-sm">
                <span>{r.description ?? "—"}</span>
                <span
                  className={
                    r.direction === "income" ? "text-income" : "text-expense"
                  }
                >
                  {r.direction === "income" ? "+" : "−"}
                  {formatEuro(r.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "income" | "expense";
}) {
  const color =
    accent === "income"
      ? "text-income"
      : accent === "expense"
        ? "text-expense"
        : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
