/**
 * Rechnungen — erstellen, auflisten, Status setzen, PDF, löschen.
 */
import { desc, eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { invoices, customers } from "@/db/schema";
import { formatEuro } from "@/lib/money";
import InvoiceForm, { type CustomerOption } from "@/components/InvoiceForm";
import InvoiceActions from "@/components/InvoiceActions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Entwurf",
  sent: "Versendet",
  paid: "Bezahlt",
  cancelled: "Storniert",
};
const STATUS_STYLE: Record<string, string> = {
  draft: "bg-black/5 text-muted",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-income/10 text-income",
  cancelled: "bg-expense/10 text-expense",
};

export default async function InvoicesPage() {
  const customerRows = (await db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .orderBy(asc(customers.name))) as CustomerOption[];

  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      date: invoices.date,
      total: invoices.total,
      status: invoices.status,
      customerName: customers.name,
    })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .orderBy(desc(invoices.date), desc(invoices.createdAt))
    .limit(200);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-1 text-2xl font-bold">Rechnungen</h1>
      <p className="mb-6 text-sm text-muted">
        Rechnungen für Auftragsfertigung — als PDF mit §19-Hinweis. „Bezahlt&quot;
        legt automatisch eine Einnahme an.
      </p>

      {customerRows.length === 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Lege zuerst unter <strong>Kunden</strong> einen Kunden an, dann kannst
          du Rechnungen erstellen.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
          <div>
            <InvoiceForm customers={customerRows} />
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">
              Rechnungen ({rows.length})
            </h2>
            {rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">
                Noch keine Rechnungen. Erstelle links deine erste.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                      <th className="py-2 pr-3">Nummer</th>
                      <th className="py-2 pr-3">Datum</th>
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
                        <td className="py-2 pr-3 whitespace-nowrap">{r.date}</td>
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
                          <InvoiceActions id={r.id} status={r.status} />
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
