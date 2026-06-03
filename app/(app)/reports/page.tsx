/**
 * Auswertungen — EÜR-Jahresübersicht mit AfA und CSV-Export.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, categories, transactions } from "@/db/schema";
import { depreciationForYear, depreciationSchedule } from "@/lib/calc/afa";
import {
  monthlySummary,
  profitAfterDepreciation,
  totalExpenses,
  totalIncome,
  type Booking,
} from "@/lib/calc/eur";
import { formatEuro } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type TxRow = {
  id: string;
  date: string;
  direction: "income" | "expense";
  amount: number;
  status: "posted" | "cancelled";
  description: string | null;
  categoryName: string | null;
};

type CategorySummary = {
  key: string;
  direction: "income" | "expense";
  label: string;
  amount: number;
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mrz",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const query = await searchParams;
  const currentYear = new Date().getFullYear();
  const selectedYear = Number(query.year);
  const year = Number.isInteger(selectedYear) ? selectedYear : currentYear;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [txRows, assetRows] = await Promise.all([
    db
      .select({
        id: transactions.id,
        date: transactions.date,
        direction: transactions.direction,
        amount: transactions.amount,
        status: transactions.status,
        description: transactions.description,
        categoryName: categories.name,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.ownerId, user.id))
      .orderBy(desc(transactions.date), desc(transactions.createdAt))
      .limit(1000),
    db
      .select()
      .from(assets)
      .where(eq(assets.ownerId, user.id))
      .limit(500),
  ]);

  const bookings: Booking[] = txRows.map((row) => ({
    date: row.date,
    direction: row.direction,
    amount: row.amount,
    status: row.status,
  }));

  const income = totalIncome(bookings, year);
  const expenses = totalExpenses(bookings, year);
  const depreciation = assetRows.reduce(
    (sum, asset) => sum + depreciationForYear(asset, year),
    0,
  );
  const result = profitAfterDepreciation(bookings, year, depreciation);
  const categoriesForYear = categorySummary(txRows, year);
  const months = monthlySummary(bookings, year);
  const years = availableYears(txRows, assetRows, currentYear);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold">Auswertungen / EÜR</h1>
          <p className="text-sm text-muted">
            Jahresübersicht nach Zufluss-/Abflussprinzip inklusive AfA.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <form action="/reports" className="flex gap-2">
            <select
              name="year"
              defaultValue={String(year)}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
            >
              {years.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:bg-black/5"
            >
              Anzeigen
            </button>
          </form>
          <Link
            href={`/reports/export?year=${year}`}
            className="brand-gradient rounded-lg px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            CSV exportieren
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Einnahmen" value={formatEuro(income)} accent="income" />
        <Kpi label="Ausgaben" value={formatEuro(expenses)} accent="expense" />
        <Kpi label="AfA" value={formatEuro(depreciation)} accent="expense" />
        <Kpi label="Gewinn" value={formatEuro(result)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Monatsübersicht {year}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3">Monat</th>
                  <th className="py-2 pr-3 text-right">Einnahmen</th>
                  <th className="py-2 pr-3 text-right">Ausgaben</th>
                  <th className="py-2 text-right">Gewinn vor AfA</th>
                </tr>
              </thead>
              <tbody>
                {months.map((month) => (
                  <tr key={month.month} className="border-b border-border/60">
                    <td className="py-2 pr-3">{MONTH_LABELS[month.month - 1]}</td>
                    <td className="py-2 pr-3 text-right text-income">
                      {formatEuro(month.income)}
                    </td>
                    <td className="py-2 pr-3 text-right text-expense">
                      {formatEuro(month.expenses)}
                    </td>
                    <td className="py-2 text-right">{formatEuro(month.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Kategorie-Aufschlüsselung</h2>
          {categoriesForYear.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              Keine Buchungen in diesem Jahr.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {categoriesForYear.map((category) => (
                <li key={category.key} className="flex justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{category.label}</span>
                  <span
                    className={`whitespace-nowrap ${
                      category.direction === "income" ? "text-income" : "text-expense"
                    }`}
                  >
                    {category.direction === "income" ? "+" : "−"}
                    {formatEuro(category.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">AfA des Jahres</h2>
        {assetRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            Keine Anlagen vorhanden.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3">Anlage</th>
                  <th className="py-2 pr-3">Anschaffung</th>
                  <th className="py-2 pr-3 text-right">Kosten</th>
                  <th className="py-2 pr-3 text-right">AfA {year}</th>
                  <th className="py-2 text-right">Buchwert Jahresende</th>
                </tr>
              </thead>
              <tbody>
                {assetRows.map((asset) => {
                  const schedule = depreciationSchedule(asset);
                  const entry = schedule.find((item) => item.year === year);
                  return (
                    <tr key={asset.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 font-medium">{asset.name}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {asset.purchaseDate}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">
                        {formatEuro(asset.cost)}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap text-expense">
                        {formatEuro(entry?.amount ?? 0)}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        {formatEuro(entry?.bookValueEnd ?? currentBookValue(schedule, year))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function categorySummary(rows: TxRow[], year: number): CategorySummary[] {
  const grouped = new Map<string, CategorySummary>();

  for (const row of rows) {
    if (row.status === "cancelled" || Number(row.date.slice(0, 4)) !== year) {
      continue;
    }
    const label = row.categoryName ?? "Ohne Kategorie";
    const key = `${row.direction}:${label}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.amount += row.amount;
    } else {
      grouped.set(key, {
        key,
        direction: row.direction,
        label,
        amount: row.amount,
      });
    }
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (a.direction !== b.direction) return a.direction === "income" ? -1 : 1;
    return b.amount - a.amount;
  });
}

function availableYears(
  rows: Pick<TxRow, "date">[],
  assetRows: { purchaseDate: string; cost: number; usefulLifeYears: number }[],
  fallback: number,
): number[] {
  const years = new Set<number>([fallback]);
  for (const row of rows) years.add(Number(row.date.slice(0, 4)));
  for (const asset of assetRows) {
    for (const entry of depreciationSchedule(asset)) years.add(entry.year);
  }
  return Array.from(years).sort((a, b) => b - a);
}

function currentBookValue(
  schedule: { year: number; bookValueEnd: number; amount: number }[],
  year: number,
): number {
  if (schedule.length === 0) return 0;
  const latest = schedule.filter((entry) => entry.year <= year).at(-1);
  if (latest) return latest.bookValueEnd;
  return schedule[0].bookValueEnd + schedule[0].amount;
}

function Kpi({
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
