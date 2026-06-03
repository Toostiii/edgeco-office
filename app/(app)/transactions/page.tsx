/**
 * Einnahmen / Ausgaben — Buchungen erfassen, bearbeiten, löschen, auflisten.
 */
import Link from "next/link";
import { desc, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { transactions, categories, receipts } from "@/db/schema";
import { formatEuro } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import TransactionForm, {
  type CategoryOption,
  type ReceiptOption,
  type EditTx,
} from "@/components/TransactionForm";
import DeleteButton from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;

  const [cats, receiptRows, rows] = await Promise.all([
    db
      .select({
        id: categories.id,
        name: categories.name,
        direction: categories.direction,
      })
      .from(categories)
      .orderBy(categories.name) as Promise<CategoryOption[]>,
    db
      .select({
        id: receipts.id,
        note: receipts.note,
        uploadedAt: receipts.uploadedAt,
      })
      .from(receipts)
      .orderBy(desc(receipts.uploadedAt))
      .limit(100),
    db
      .select({
        id: transactions.id,
        date: transactions.date,
        direction: transactions.direction,
        amount: transactions.amount,
        description: transactions.description,
        paymentMethod: transactions.paymentMethod,
        categoryName: categories.name,
        receiptId: transactions.receiptId,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .orderBy(desc(transactions.date), desc(transactions.createdAt))
      .limit(100),
  ]);

  const receiptOptions: ReceiptOption[] = receiptRows.map((r) => ({
    id: r.id,
    label: `${r.note ?? "Beleg"} · ${
      r.uploadedAt ? new Date(r.uploadedAt).toLocaleDateString("de-DE") : ""
    }`,
  }));

  // Bearbeitungsmodus: die zu bearbeitende Buchung laden.
  let editTx: EditTx | undefined;
  if (edit) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const found = await db
        .select()
        .from(transactions)
        .where(
          and(eq(transactions.id, edit), eq(transactions.ownerId, user.id)),
        )
        .limit(1);
      if (found[0]) {
        const t = found[0];
        editTx = {
          id: t.id,
          direction: t.direction,
          amount: t.amount,
          date: t.date,
          categoryId: t.categoryId,
          receiptId: t.receiptId,
          description: t.description,
          paymentMethod: t.paymentMethod,
        };
      }
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold">Einnahmen / Ausgaben</h1>
      <p className="mb-6 text-sm text-muted">
        Erfasse jede Buchung — die EÜR und das Dashboard aktualisieren sich
        automatisch.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <div>
          <TransactionForm
            categories={cats}
            receipts={receiptOptions}
            editTx={editTx}
          />
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
                    const isEditing = r.id === edit;
                    return (
                      <tr
                        key={r.id}
                        className={`border-b border-border/60 ${
                          isEditing ? "bg-brand/5" : ""
                        }`}
                      >
                        <td className="py-2 pr-3 whitespace-nowrap">{r.date}</td>
                        <td className="py-2 pr-3">
                          {r.description ?? "—"}
                          {r.receiptId && (
                            <span title="Beleg verknüpft" className="ml-1">
                              📎
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-muted">
                          {r.categoryName ?? "—"}
                        </td>
                        <td
                          className={`py-2 pr-3 text-right whitespace-nowrap ${
                            r.direction === "income"
                              ? "text-income"
                              : "text-expense"
                          }`}
                        >
                          {r.direction === "income" ? "+" : "−"}
                          {formatEuro(r.amount)}
                        </td>
                        <td className="py-2 text-right whitespace-nowrap">
                          <Link
                            href={`/transactions?edit=${r.id}`}
                            className="mr-3 text-xs text-muted underline-offset-2 hover:text-brand hover:underline"
                          >
                            Bearbeiten
                          </Link>
                          <DeleteButton id={r.id} />
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
