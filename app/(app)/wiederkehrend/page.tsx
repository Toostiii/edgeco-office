/**
 * Wiederkehrende Buchungen — Vorlagen für monatliche/wöchentliche/jährliche
 * Fixkosten, die mit einem Klick als Buchung übernommen werden.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { recurringTransactions, categories } from "@/db/schema";
import { getCachedUser } from "@/lib/supabase/user";
import { formatEuro } from "@/lib/money";
import RecurringForm, { type CategoryOption } from "@/components/RecurringForm";
import RecurringActions from "@/components/RecurringActions";

export const dynamic = "force-dynamic";

const FREQUENCY_LABEL: Record<string, string> = {
  monthly: "Monatlich",
  weekly: "Wöchentlich",
  yearly: "Jährlich",
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default async function WiederkehrendPage() {
  const user = await getCachedUser();

  const [rows, cats] = await Promise.all([
    user
      ? db
          .select({
            id: recurringTransactions.id,
            direction: recurringTransactions.direction,
            amount: recurringTransactions.amount,
            description: recurringTransactions.description,
            frequency: recurringTransactions.frequency,
            nextDue: recurringTransactions.nextDue,
            active: recurringTransactions.active,
            categoryName: categories.name,
          })
          .from(recurringTransactions)
          .leftJoin(categories, eq(recurringTransactions.categoryId, categories.id))
          .where(eq(recurringTransactions.ownerId, user.id))
          .orderBy(desc(recurringTransactions.active), recurringTransactions.nextDue)
          .limit(200)
      : [],
    db
      .select({ id: categories.id, name: categories.name, direction: categories.direction })
      .from(categories)
      .orderBy(categories.name) as Promise<CategoryOption[]>,
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold">Wiederkehrende Buchungen</h1>
      <p className="mb-6 text-sm text-muted">
        Vorlagen für regelmäßige Fixkosten — mit einem Klick als Buchung übernehmen.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <div>
          <RecurringForm categories={cats} />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Vorlagen ({rows.length})</h2>
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              Noch keine Vorlagen. Lege links deine erste an.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3">Beschreibung</th>
                    <th className="py-2 pr-3">Kategorie</th>
                    <th className="py-2 pr-3 text-right">Betrag</th>
                    <th className="py-2 pr-3">Frequenz</th>
                    <th className="py-2 pr-3">Nächste Fälligkeit</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-b border-border/60 ${!r.active ? "opacity-50" : ""}`}
                    >
                      <td className="py-2 pr-3">{r.description}</td>
                      <td className="py-2 pr-3 text-muted">{r.categoryName ?? "—"}</td>
                      <td
                        className={`py-2 pr-3 text-right whitespace-nowrap ${
                          r.direction === "income" ? "text-income" : "text-expense"
                        }`}
                      >
                        {r.direction === "income" ? "+" : "−"}
                        {formatEuro(r.amount)}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {FREQUENCY_LABEL[r.frequency]}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {formatDate(r.nextDue)}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.active
                              ? "bg-income/10 text-income"
                              : "bg-black/5 text-muted"
                          }`}
                        >
                          {r.active ? "Aktiv" : "Inaktiv"}
                        </span>
                      </td>
                      <td className="py-2">
                        <RecurringActions id={r.id} active={r.active} />
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
