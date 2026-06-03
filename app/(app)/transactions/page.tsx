/**
 * Einnahmen / Ausgaben — Buchungen erfassen und auflisten.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { transactions, categories } from "@/db/schema";
import { formatEuro } from "@/lib/money";
import TransactionForm, {
  type CategoryOption,
} from "@/components/TransactionForm";
import StornoButton from "@/components/StornoButton";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const cats = (await db
    .select({
      id: categories.id,
      name: categories.name,
      direction: categories.direction,
    })
    .from(categories)
    .orderBy(categories.name)) as CategoryOption[];

  const rows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      direction: transactions.direction,
      amount: transactions.amount,
      description: transactions.description,
      paymentMethod: transactions.paymentMethod,
      status: transactions.status,
      categoryName: categories.name,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(100);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold">Einnahmen / Ausgaben</h1>
      <p className="mb-6 text-sm text-muted">
        Erfasse jede Buchung — die EÜR und das Dashboard aktualisieren sich
        automatisch.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <div>
          <TransactionForm categories={cats} />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">
            Buchungen ({rows.length})
          </h2>
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              Noch keine Buchungen. Lege links deine erste an.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3">Datum</th>
                    <th className="py-2 pr-3">Beschreibung</th>
                    <th className="py-2 pr-3">Kategorie</th>
                    <th className="py-2 pr-3 text-right">Betrag</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const cancelled = r.status === "cancelled";
                    return (
                      <tr
                        key={r.id}
                        className={`border-b border-border/60 ${
                          cancelled ? "text-muted line-through" : ""
                        }`}
                      >
                        <td className="py-2 pr-3 whitespace-nowrap">{r.date}</td>
                        <td className="py-2 pr-3">{r.description ?? "—"}</td>
                        <td className="py-2 pr-3 text-muted">
                          {r.categoryName ?? "—"}
                        </td>
                        <td
                          className={`py-2 pr-3 text-right whitespace-nowrap ${
                            cancelled
                              ? ""
                              : r.direction === "income"
                                ? "text-income"
                                : "text-expense"
                          }`}
                        >
                          {r.direction === "income" ? "+" : "−"}
                          {formatEuro(r.amount)}
                        </td>
                        <td className="py-2 text-right">
                          {cancelled ? (
                            <span className="text-xs text-muted">storniert</span>
                          ) : (
                            <StornoButton id={r.id} />
                          )}
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
    </div>
  );
}
