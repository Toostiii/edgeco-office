/**
 * Reisekosten — Kilometerpauschale erfassen, optional als Ausgabe buchen.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { travelExpenses } from "@/db/schema";
import { getCachedUser } from "@/lib/supabase/user";
import { formatEuro } from "@/lib/money";
import TravelExpenseForm from "@/components/TravelExpenseForm";
import TravelDeleteButton from "@/components/TravelDeleteButton";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default async function ReisekostenPage() {
  const user = await getCachedUser();

  const rows = user
    ? await db
        .select()
        .from(travelExpenses)
        .where(eq(travelExpenses.ownerId, user.id))
        .orderBy(desc(travelExpenses.date), desc(travelExpenses.createdAt))
        .limit(200)
    : [];

  const sum = rows.reduce((acc, r) => acc + r.totalCents, 0);
  const sumKm = rows.reduce((acc, r) => acc + r.distanceKm, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold">Reisekosten</h1>
      <p className="mb-6 text-sm text-muted">
        Erfasse Fahrten mit der Kilometerpauschale (Standard 0,30 €/km).
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <div>
          <TravelExpenseForm />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Einträge ({rows.length})</h2>
            <span className="text-sm text-muted">
              {sumKm} km · {formatEuro(sum)}
            </span>
          </div>
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              Noch keine Reisekosten erfasst.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3">Datum</th>
                    <th className="py-2 pr-3">Zweck</th>
                    <th className="py-2 pr-3 text-right">km</th>
                    <th className="py-2 pr-3 text-right">Satz</th>
                    <th className="py-2 pr-3 text-right">Betrag</th>
                    <th className="py-2 pr-3">Gebucht</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {formatDate(r.date)}
                      </td>
                      <td className="py-2 pr-3">{r.purpose}</td>
                      <td className="py-2 pr-3 text-right">{r.distanceKm}</td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">
                        {formatEuro(r.ratePerKmCents)}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap font-medium">
                        {formatEuro(r.totalCents)}
                      </td>
                      <td className="py-2 pr-3">
                        {r.transactionId ? (
                          <span className="rounded-full bg-income/10 px-2 py-0.5 text-xs font-medium text-income">
                            ja
                          </span>
                        ) : (
                          <span className="text-xs text-muted">nein</span>
                        )}
                      </td>
                      <td className="py-2">
                        <TravelDeleteButton id={r.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
