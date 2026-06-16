/**
 * Kategorien — Stammdaten für die EÜR (anlegen, bearbeiten, löschen).
 * Zeigt eigene und geteilte Standard-Kategorien (Seed) samt Nutzungszähler.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { getCachedUser } from "@/lib/supabase/user";
import { findKennzahl } from "@/lib/elster";
import CategoryForm, { type EditCategory } from "@/components/CategoryForm";
import CategoryDeleteButton from "@/components/CategoryDeleteButton";

export const dynamic = "force-dynamic";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;

  const user = await getCachedUser();
  if (!user) redirect("/login");

  const visible = or(
    eq(categories.ownerId, user.id),
    isNull(categories.ownerId),
  );

  const [rows, usageRows] = await Promise.all([
    db
      .select({
        id: categories.id,
        name: categories.name,
        direction: categories.direction,
        elsterKennzahl: categories.elsterKennzahl,
      })
      .from(categories)
      .where(visible)
      .orderBy(asc(categories.direction), asc(categories.name)),
    db
      .select({
        categoryId: transactions.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(transactions)
      .where(eq(transactions.ownerId, user.id))
      .groupBy(transactions.categoryId),
  ]);

  const usage = new Map<string, number>();
  for (const row of usageRows) {
    if (row.categoryId) usage.set(row.categoryId, row.count);
  }

  let editCategory: EditCategory | undefined;
  if (edit) {
    const found = rows.find((r) => r.id === edit);
    if (found) {
      editCategory = {
        id: found.id,
        name: found.name,
        direction: found.direction,
        elsterKennzahl: found.elsterKennzahl,
      };
    }
  }

  const income = rows.filter((r) => r.direction === "income");
  const expense = rows.filter((r) => r.direction === "expense");

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold">Kategorien</h1>
      <p className="mb-6 text-sm text-muted">
        Ordne Einnahmen und Ausgaben Kategorien zu — sie steuern die
        Aufschlüsselung in der EÜR.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <div>
          <CategoryForm editCategory={editCategory} />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <CategoryColumn
            title="Einnahmen"
            accent="income"
            items={income}
            usage={usage}
            edit={edit}
          />
          <CategoryColumn
            title="Ausgaben"
            accent="expense"
            items={expense}
            usage={usage}
            edit={edit}
          />
        </div>
      </div>
    </div>
  );
}

function CategoryColumn({
  title,
  accent,
  items,
  usage,
  edit,
}: {
  title: string;
  accent: "income" | "expense";
  items: {
    id: string;
    name: string;
    direction: "income" | "expense";
    elsterKennzahl: string | null;
  }[];
  usage: Map<string, number>;
  edit?: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-3 flex items-center justify-between text-sm font-semibold">
        <span className={accent === "income" ? "text-income" : "text-expense"}>
          {title}
        </span>
        <span className="text-xs font-normal text-muted">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          Noch keine {title.toLowerCase()}-Kategorie.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((c) => {
            const count = usage.get(c.id) ?? 0;
            const kz = findKennzahl(c.elsterKennzahl);
            return (
              <li
                key={c.id}
                className={`flex items-center justify-between gap-3 py-2.5 ${
                  c.id === edit ? "rounded-lg bg-brand/5 px-2" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted">
                    {count === 0
                      ? "keine Buchungen"
                      : count === 1
                        ? "1 Buchung"
                        : `${count} Buchungen`}
                    {kz && (
                      <span
                        title={kz.label}
                        className="ml-2 rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-medium text-muted"
                      >
                        EÜR Zeile {kz.zeile}
                      </span>
                    )}
                  </p>
                </div>
                <div className="whitespace-nowrap">
                  <Link
                    href={`/categories?edit=${c.id}`}
                    className="mr-3 text-xs text-muted underline-offset-2 hover:text-brand hover:underline"
                  >
                    Bearbeiten
                  </Link>
                  <CategoryDeleteButton id={c.id} inUse={count > 0} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
