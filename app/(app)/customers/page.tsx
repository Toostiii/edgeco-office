/**
 * Kunden — Stammdaten für Rechnungen (anlegen, bearbeiten, löschen).
 */
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import CustomerForm, { type EditCustomer } from "@/components/CustomerForm";
import CustomerDeleteButton from "@/components/CustomerDeleteButton";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;

  let editCustomer: EditCustomer | undefined;
  if (edit) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const found = await db
        .select()
        .from(customers)
        .where(and(eq(customers.id, edit), eq(customers.ownerId, user.id)))
        .limit(1);
      if (found[0]) {
        editCustomer = {
          id: found[0].id,
          name: found[0].name,
          address: found[0].address,
          email: found[0].email,
        };
      }
    }
  }

  const rows = await db
    .select()
    .from(customers)
    .orderBy(asc(customers.name))
    .limit(500);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold">Kunden</h1>
      <p className="mb-6 text-sm text-muted">
        Stammdaten deiner Kunden für Rechnungen.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <div>
          <CustomerForm editCustomer={editCustomer} />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Kundenliste ({rows.length})</h2>
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              Noch keine Kunden. Lege links deinen ersten an.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((c) => (
                <li
                  key={c.id}
                  className={`flex items-start justify-between gap-3 py-3 ${
                    c.id === edit ? "rounded-lg bg-brand/5 px-2" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium">{c.name}</p>
                    {c.address && (
                      <p className="whitespace-pre-line text-xs text-muted">
                        {c.address}
                      </p>
                    )}
                    {c.email && (
                      <p className="text-xs text-muted">{c.email}</p>
                    )}
                  </div>
                  <div className="whitespace-nowrap">
                    <Link
                      href={`/customers?edit=${c.id}`}
                      className="mr-3 text-xs text-muted underline-offset-2 hover:text-brand hover:underline"
                    >
                      Bearbeiten
                    </Link>
                    <CustomerDeleteButton id={c.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
