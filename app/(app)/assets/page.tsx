/**
 * Anlagen — Anlagevermögen verwalten und lineare AfA anzeigen.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assets } from "@/db/schema";
import AssetDeleteButton from "@/components/AssetDeleteButton";
import AssetForm, { type EditAsset } from "@/components/AssetForm";
import {
  depreciationForYear,
  depreciationSchedule,
  type DepreciationEntry,
} from "@/lib/calc/afa";
import { formatEuro } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const year = new Date().getFullYear();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let editAsset: EditAsset | undefined;
  if (edit) {
    const found = await db
      .select()
      .from(assets)
      .where(and(eq(assets.id, edit), eq(assets.ownerId, user.id)))
      .limit(1);
    if (found[0]) {
      editAsset = {
        id: found[0].id,
        name: found[0].name,
        purchaseDate: found[0].purchaseDate,
        cost: found[0].cost,
        usefulLifeYears: found[0].usefulLifeYears,
      };
    }
  }

  const rows = await db
    .select()
    .from(assets)
    .where(eq(assets.ownerId, user.id))
    .orderBy(desc(assets.purchaseDate), desc(assets.createdAt))
    .limit(500);

  const totalAfa = rows.reduce(
    (sum, asset) => sum + depreciationForYear(asset, year),
    0,
  );

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-1 text-2xl font-bold">Anlagen (AfA)</h1>
      <p className="mb-6 text-sm text-muted">
        Anlagevermögen mit linearer, monatsgenauer Abschreibung.
      </p>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi label="Anlagen" value={String(rows.length)} />
        <Kpi label={`AfA ${year}`} value={formatEuro(totalAfa)} accent="expense" />
        <Kpi
          label="Anschaffungskosten"
          value={formatEuro(rows.reduce((sum, asset) => sum + asset.cost, 0))}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <div>
          <AssetForm editAsset={editAsset} />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">
            Anlagenliste ({rows.length})
          </h2>
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              Noch keine Anlagen. Lege links deine erste an.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((asset) => {
                const schedule = depreciationSchedule(asset);
                const currentAfa = depreciationForYear(asset, year);
                const currentBookValue = bookValueAtYearEnd(schedule, year);
                return (
                  <li
                    key={asset.id}
                    className={`py-4 ${asset.id === edit ? "rounded-lg bg-brand/5 px-2" : ""}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium">{asset.name}</p>
                        <p className="mt-1 text-xs text-muted">
                          Anschaffung {asset.purchaseDate} · {formatEuro(asset.cost)} ·{" "}
                          {asset.usefulLifeYears} Jahre
                        </p>
                        <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
                          <MiniStat label={`AfA ${year}`} value={formatEuro(currentAfa)} />
                          <MiniStat
                            label={`Buchwert Ende ${year}`}
                            value={formatEuro(currentBookValue)}
                          />
                          <MiniStat
                            label="Methode"
                            value={asset.method === "linear" ? "Linear" : asset.method}
                          />
                        </div>
                      </div>
                      <div className="whitespace-nowrap">
                        <Link
                          href={`/assets?edit=${asset.id}`}
                          className="mr-3 text-xs text-muted underline-offset-2 hover:text-brand hover:underline"
                        >
                          Bearbeiten
                        </Link>
                        <AssetDeleteButton id={asset.id} />
                      </div>
                    </div>

                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-medium text-muted hover:text-brand">
                        AfA-Plan anzeigen
                      </summary>
                      <div className="mt-2 overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-black/5 text-left uppercase tracking-wide text-muted">
                              <th className="px-3 py-2">Jahr</th>
                              <th className="px-3 py-2 text-right">AfA</th>
                              <th className="px-3 py-2 text-right">Buchwert</th>
                            </tr>
                          </thead>
                          <tbody>
                            {schedule.map((entry) => (
                              <tr key={entry.year} className="border-t border-border/60">
                                <td className="px-3 py-2">{entry.year}</td>
                                <td className="px-3 py-2 text-right">
                                  {formatEuro(entry.amount)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {formatEuro(entry.bookValueEnd)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function bookValueAtYearEnd(schedule: DepreciationEntry[], year: number): number {
  const latest = schedule.filter((entry) => entry.year <= year).at(-1);
  if (latest) return latest.bookValueEnd;
  const first = schedule[0];
  return first ? first.bookValueEnd + first.amount : 0;
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "expense";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent === "expense" ? "text-expense" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}
