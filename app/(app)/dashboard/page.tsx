/**
 * Dashboard — EÜR-Überblick des laufenden Jahres.
 * Liest Buchungen, Anlagen und Rechnungen aus der DB und rechnet über lib/calc.
 */
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { assets, invoices, transactions } from "@/db/schema";
import {
  depreciationForYear,
  depreciationSchedule,
  type DepreciationEntry,
} from "@/lib/calc/afa";
import {
  totalIncome,
  totalExpenses,
  profitAfterDepreciation,
  type Booking,
} from "@/lib/calc/eur";
import { formatEuro } from "@/lib/money";
import { getCachedUser } from "@/lib/supabase/user";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const year = new Date().getFullYear();
  const user = await getCachedUser();
  if (!user) redirect("/login");

  const [rows, assetRows, invoiceRows] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(eq(transactions.ownerId, user.id))
      .orderBy(desc(transactions.date))
      .limit(200),
    db.select().from(assets).where(eq(assets.ownerId, user.id)).limit(500),
    db
      .select({ status: invoices.status, total: invoices.total })
      .from(invoices)
      .where(eq(invoices.ownerId, user.id)),
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

  // Offene (versendete, noch nicht bezahlte) Rechnungen.
  const openInvoices = invoiceRows.filter((i) => i.status === "sent");
  const openSum = openInvoices.reduce((sum, i) => sum + i.total, 0);

  // Aktueller Buchwert aller Anlagen zum Jahresende.
  const bookValue = assetRows.reduce(
    (sum, asset) => sum + bookValueAtYearEnd(depreciationSchedule(asset), year),
    0,
  );

  // Anzahl aktiver Buchungen im laufenden Jahr.
  const bookingsThisYear = bookings.filter(
    (b) => b.status !== "cancelled" && Number(b.date.slice(0, 4)) === year,
  ).length;

  const recent = rows.slice(0, 5);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold">Dashboard</h1>
      <p className="mb-6 text-sm text-muted">Geschäftsjahr {year}</p>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={`Einnahmen ${year}`} value={formatEuro(income)} accent="income" />
        <KpiCard label={`Ausgaben ${year}`} value={formatEuro(expenses)} accent="expense" />
        <KpiCard label={`AfA ${year}`} value={formatEuro(depreciation)} accent="expense" />
        <KpiCard label="Gewinn (EÜR inkl. AfA)" value={formatEuro(gewinn)} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Offene Rechnungen"
          value={formatEuro(openSum)}
          sub={
            openInvoices.length === 1
              ? "1 versendet, unbezahlt"
              : `${openInvoices.length} versendet, unbezahlt`
          }
        />
        <KpiCard
          label="Anlagen-Buchwert"
          value={formatEuro(bookValue)}
          sub={
            assetRows.length === 1 ? "1 Anlage" : `${assetRows.length} Anlagen`
          }
        />
        <KpiCard
          label={`Buchungen ${year}`}
          value={String(bookingsThisYear)}
          sub="erfasst"
        />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">Schnellzugriff</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickLink href="/transactions" icon="💶" label="Buchung erfassen" />
          <QuickLink href="/receipts" icon="📎" label="Beleg hochladen" />
          <QuickLink href="/invoices" icon="🧾" label="Rechnung erstellen" />
          <QuickLink href="/reports" icon="📈" label="EÜR / Auswertung" />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Letzte Buchungen</h2>
          <Link
            href="/transactions"
            className="text-xs text-muted underline-offset-2 hover:text-brand hover:underline"
          >
            Alle anzeigen
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            Noch keine Buchungen. Erfasse links deine erste Einnahme oder
            Ausgabe.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((r) => (
              <li key={r.id} className="flex justify-between py-2 text-sm">
                <span>
                  {r.description ?? "—"}
                  <span className="ml-2 text-xs text-muted">{r.date}</span>
                </span>
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

/** Buchwert am Jahresende; vor Anschaffung = Anschaffungskosten, danach 0. */
function bookValueAtYearEnd(
  schedule: DepreciationEntry[],
  year: number,
): number {
  if (schedule.length === 0) return 0;
  const upto = schedule.filter((e) => e.year <= year);
  if (upto.length === 0) return schedule[0].bookValueEnd + schedule[0].amount;
  return upto[upto.length - 1].bookValueEnd;
}

function KpiCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string;
  accent?: "income" | "expense";
  sub?: string;
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
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 text-sm shadow-sm transition hover:border-brand hover:bg-brand/5"
    >
      <span className="text-xl">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}
