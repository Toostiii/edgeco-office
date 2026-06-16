"use client";

import { useActionState, useMemo, useState } from "react";
import {
  importBankRows,
  type ImportState,
} from "@/app/(app)/bankkonto/actions";
import { parseBankCsv, type BankRow } from "@/lib/import/bank-csv";
import { formatEuro } from "@/lib/money";

export type CategoryOption = {
  id: string;
  name: string;
  direction: "income" | "expense";
};

type Row = BankRow & { selected: boolean; categoryId: string };

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default function BankImportForm({
  categories,
}: {
  categories: CategoryOption[];
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    importBankRows,
    {},
  );

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setParseError(null);
    setRows(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) {
      setParseError("Datei ist zu groß (max. 5 MB).");
      return;
    }
    const text = await file.text();
    const parsed = parseBankCsv(text);
    if (parsed.length === 0) {
      setParseError(
        "Keine Umsätze erkannt. Prüfe, ob es ein CSV-Kontoauszug ist.",
      );
      return;
    }
    setRows(
      parsed.map((r) => ({ ...r, selected: true, categoryId: "" })),
    );
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) =>
      rs ? rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) : rs,
    );
  }

  function setAllCategory(categoryId: string) {
    setRows((rs) =>
      rs
        ? rs.map((r) => {
            // Nur passende Richtung übernehmen.
            const cat = categories.find((c) => c.id === categoryId);
            if (!cat) return { ...r, categoryId: "" };
            const dir = r.amountCents >= 0 ? "income" : "expense";
            return cat.direction === dir ? { ...r, categoryId } : r;
          })
        : rs,
    );
  }

  function toggleAll(selected: boolean) {
    setRows((rs) => (rs ? rs.map((r) => ({ ...r, selected })) : rs));
  }

  const selectedRows = useMemo(
    () => (rows ?? []).filter((r) => r.selected),
    [rows],
  );
  const payload = useMemo(
    () =>
      JSON.stringify(
        selectedRows.map((r) => ({
          date: r.date,
          description: r.description,
          amountCents: r.amountCents,
          categoryId: r.categoryId || null,
        })),
      ),
    [selectedRows],
  );
  const selectedSum = selectedRows.reduce((s, r) => s + r.amountCents, 0);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold">Kontoauszug (CSV) wählen</h2>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-black/5 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-black/10 focus:border-brand"
        />
        {parseError && (
          <p className="mt-3 text-sm text-expense">{parseError}</p>
        )}
      </div>

      {rows && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                Vorschau ({rows.length} Umsätze)
              </h2>
              <p className="mt-1 text-xs text-muted">
                {selectedRows.length} ausgewählt · Summe{" "}
                {formatEuro(selectedSum)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => toggleAll(true)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-black/5"
              >
                Alle
              </button>
              <button
                type="button"
                onClick={() => toggleAll(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-black/5"
              >
                Keine
              </button>
              <select
                onChange={(e) => setAllCategory(e.target.value)}
                defaultValue=""
                className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs outline-none focus:border-brand"
                title="Kategorie für alle passenden Zeilen setzen"
              >
                <option value="">Kategorie für alle …</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.direction === "income" ? "E" : "A"})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {state.error && (
            <p className="mb-3 text-sm text-expense">{state.error}</p>
          )}
          {state.success && (
            <p className="mb-3 text-sm text-income">
              {state.imported ?? 0} Buchungen importiert
              {(state.skipped ?? 0) > 0
                ? ` · ${state.skipped} übersprungen`
                : ""}
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-2"></th>
                  <th className="py-2 pr-3">Datum</th>
                  <th className="py-2 pr-3">Beschreibung</th>
                  <th className="py-2 pr-3 text-right">Betrag</th>
                  <th className="py-2 pr-3">Kategorie</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const dir = r.amountCents >= 0 ? "income" : "expense";
                  const cats = categories.filter((c) => c.direction === dir);
                  return (
                    <tr key={i} className="border-b border-border/60">
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={r.selected}
                          onChange={(e) =>
                            update(i, { selected: e.target.checked })
                          }
                        />
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {formatDate(r.date)}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="block max-w-xs truncate" title={r.description}>
                          {r.description}
                        </span>
                      </td>
                      <td
                        className={`py-2 pr-3 text-right whitespace-nowrap ${
                          dir === "income" ? "text-income" : "text-expense"
                        }`}
                      >
                        {dir === "income" ? "+" : "−"}
                        {formatEuro(Math.abs(r.amountCents))}
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          value={r.categoryId}
                          onChange={(e) =>
                            update(i, { categoryId: e.target.value })
                          }
                          className="rounded-lg border border-border bg-white px-2 py-1 text-xs outline-none focus:border-brand"
                        >
                          <option value="">— ohne —</option>
                          {cats.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <form action={formAction} className="mt-5">
            <input type="hidden" name="rows" value={payload} />
            <button
              type="submit"
              disabled={pending || selectedRows.length === 0}
              className="brand-gradient w-full rounded-lg py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {pending
                ? "Importiere …"
                : `${selectedRows.length} Buchungen importieren`}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
