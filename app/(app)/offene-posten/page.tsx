/**
 * Offene-Posten-Übersicht — alle Rechnungen, die noch nicht bezahlt/storniert
 * sind. Überfällige (dueDate < heute) werden hervorgehoben.
 */
import Link from "next/link";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { invoices, customers } from "@/db/schema";
import { formatEuro } from "@/lib/money";
import InvoiceActions from "@/components/InvoiceActions";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Entwurf",
  sent: "Versendet",
};
const STATUS_STYLE: Record<string, string> = {
  draft: "bg-black/5 text-muted",
  sent: "bg-blue-100 text-blue-700",
};

export default async function OffenePostenPage() {
  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      date: invoices.date,
      dueDate: invoices.dueDate,
      total: invoices.total,
      status: invoices.status,
      dunningLevel: invoices.dunningLevel,
      customerName: customers.name,
    })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .where(and(ne(invoices.status, "paid"), ne(invoices.status, "cancelled")))
    .orderBy(desc(invoices.dueDate), desc(invoices.date))
    .limit(300);

  const today = new Date().toISOString().slice(0, 10);
  const dayMs = 1000 * 60 * 60 * 24;
  const sum = rows.reduce((acc, r) => acc + r.total, 0);
  const overdueSum = rows.reduce(
    (acc, r) => acc + (r.dueDate && r.dueDate < today ? r.total : 0),
    0,
  );

  function daysOverdue(due: string | null): number | null {
    if (!due || due >= today) return null;
    return Math.floor(
      (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) /
        dayMs,
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-1 text-2xl font-bold">Offene Posten</h1>
      <p className="mb-6 text-sm text-muted">
        Rechnungen, die noch nicht bezahlt sind. Überfällige Posten sind rot
        markiert.
      </p>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted">
            Summe offene Posten
          </p>
          <p className="mt-1 text-2xl font-bold">{formatEuro(sum)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted">
            davon überfällig
          </p>
          <p className="mt-1 text-2xl font-bold text-expense">
            {formatEuro(overdueSum)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">
          Offene Rechnungen ({rows.length})
        </h2>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            Keine offenen Posten — alle Rechnungen sind bezahlt. 🎉
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3">Nummer</th>
                  <th className="py-2 pr-3">Datum</th>
                  <th className="py-2 pr-3">Fällig</th>
                  <th className="py-2 pr-3">Kunde</th>
                  <th className="py-2 pr-3 text-right">Betrag</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Überfällig</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const over = daysOverdue(r.dueDate);
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-border/60 ${
                        over !== null ? "bg-expense/5" : ""
                      }`}
                    >
                      <td className="py-2 pr-3 font-medium whitespace-nowrap">
                        <Link
                          href="/invoices"
                          className="hover:text-brand hover:underline"
                        >
                          {r.number}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {formatDate(r.date)}
                      </td>
                      <td
                        className={`py-2 pr-3 whitespace-nowrap ${
                          over !== null ? "font-semibold text-expense" : ""
                        }`}
                      >
                        {formatDate(r.dueDate)}
                      </td>
                      <td className="py-2 pr-3">{r.customerName ?? "—"}</td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">
                        {formatEuro(r.total)}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_STYLE[r.status] ?? "bg-black/5 text-muted"
                          }`}
                        >
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap text-expense">
                        {over !== null ? `${over} Tage` : "—"}
                      </td>
                      <td className="py-2">
                        <InvoiceActions
                          id={r.id}
                          status={r.status}
                          dueDate={r.dueDate}
                          dunningLevel={r.dunningLevel ?? 0}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
