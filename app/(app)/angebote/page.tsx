/**
 * Angebote — erstellen, auflisten, Status setzen, in Rechnung umwandeln.
 */
import { desc, eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { quotes, customers } from "@/db/schema";
import { formatEuro } from "@/lib/money";
import QuoteForm, { type CustomerOption } from "@/components/QuoteForm";
import QuoteActions from "@/components/QuoteActions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Entwurf",
  sent: "Versendet",
  accepted: "Angenommen",
  rejected: "Abgelehnt",
  converted: "Umgewandelt",
};
const STATUS_STYLE: Record<string, string> = {
  draft: "bg-black/5 text-muted",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-income/10 text-income",
  rejected: "bg-expense/10 text-expense",
  converted: "bg-brand/10 text-brand",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default async function AngebotePage() {
  const [customerRows, rows] = await Promise.all([
    db
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .orderBy(asc(customers.name)) as Promise<CustomerOption[]>,
    db
      .select({
        id: quotes.id,
        number: quotes.number,
        date: quotes.date,
        validUntil: quotes.validUntil,
        total: quotes.total,
        status: quotes.status,
        customerName: customers.name,
      })
      .from(quotes)
      .leftJoin(customers, eq(quotes.customerId, customers.id))
      .orderBy(desc(quotes.date), desc(quotes.createdAt))
      .limit(200),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-1 text-2xl font-bold">Angebote</h1>
      <p className="mb-6 text-sm text-muted">
        Erstelle Angebote (§19-Hinweis, freibleibend) und wandle sie mit einem
        Klick in Rechnungen um.
      </p>

      {customerRows.length === 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Lege zuerst unter <strong>Kunden</strong> einen Kunden an, dann kannst
          du Angebote erstellen.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
          <div>
            <QuoteForm customers={customerRows} />
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">
              Angebote ({rows.length})
            </h2>
            {rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">
                Noch keine Angebote. Erstelle links dein erstes.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                      <th className="py-2 pr-3">Nummer</th>
                      <th className="py-2 pr-3">Datum</th>
                      <th className="py-2 pr-3">Gültig bis</th>
                      <th className="py-2 pr-3">Kunde</th>
                      <th className="py-2 pr-3 text-right">Betrag</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-border/60">
                        <td className="py-2 pr-3 font-medium whitespace-nowrap">
                          {r.number}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {formatDate(r.date)}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {formatDate(r.validUntil)}
                        </td>
                        <td className="py-2 pr-3">{r.customerName ?? "—"}</td>
                        <td className="py-2 pr-3 text-right whitespace-nowrap">
                          {formatEuro(r.total)}
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              STATUS_STYLE[r.status]
                            }`}
                          >
                            {STATUS_LABEL[r.status]}
                          </span>
                        </td>
                        <td className="py-2">
                          <QuoteActions id={r.id} status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
