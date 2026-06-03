"use client";

import { useActionState, useMemo } from "react";
import {
  importShopifyOrders,
  previewShopifyImport,
  type ImportState,
  type PreviewState,
  type ShopifyPreviewOrder,
} from "@/app/(app)/shopify/actions";
import { formatEuro } from "@/lib/money";

export default function ShopifyImportForm() {
  const [preview, previewAction, previewPending] = useActionState<
    PreviewState,
    FormData
  >(previewShopifyImport, {});
  const [importState, importAction, importPending] = useActionState<
    ImportState,
    FormData
  >(importShopifyOrders, {});

  const importableOrders = useMemo(
    () => preview.orders?.filter((order) => order.importable) ?? [],
    [preview.orders],
  );
  const importPayload = useMemo(
    () => JSON.stringify(importableOrders),
    [importableOrders],
  );

  return (
    <div className="space-y-6">
      <form
        action={previewAction}
        className="rounded-xl border border-border bg-card p-5 shadow-sm"
      >
        <h2 className="mb-4 text-sm font-semibold">Shopify-Datei prüfen</h2>

        <Field label="CSV/JSON-Datei">
          <input
            name="file"
            type="file"
            accept=".csv,.json,text/csv,application/json"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-black/5 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-black/10 focus:border-brand"
          />
        </Field>

        <Field label="Importinhalt" className="mt-4">
          <textarea
            name="payload"
            rows={5}
            placeholder="CSV oder JSON einfügen"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </Field>

        {preview.error && (
          <p className="mt-3 text-sm text-expense">{preview.error}</p>
        )}

        <button
          type="submit"
          disabled={previewPending}
          className="brand-gradient mt-5 w-full rounded-lg py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {previewPending ? "Prüfe …" : "Vorschau erstellen"}
        </button>
      </form>

      {preview.orders && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Importvorschau</h2>
              {preview.summary && (
                <p className="mt-1 text-xs text-muted">
                  {preview.summary.parsed} erkannt · {preview.summary.ready} bereit ·{" "}
                  {preview.summary.duplicates} doppelt
                </p>
              )}
            </div>

            <form action={importAction}>
              <input type="hidden" name="orders" value={importPayload} />
              <button
                type="submit"
                disabled={importPending || importableOrders.length === 0}
                className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {importPending
                  ? "Importiere …"
                  : `${importableOrders.length} importieren`}
              </button>
            </form>
          </div>

          {importState.error && (
            <p className="mb-3 text-sm text-expense">{importState.error}</p>
          )}
          {importState.success && (
            <p className="mb-3 text-sm text-income">
              {importState.imported ?? 0} Buchungen importiert
              {(importState.skipped ?? 0) > 0
                ? ` · ${importState.skipped} übersprungen`
                : ""}
            </p>
          )}

          {preview.parseErrors && preview.parseErrors.length > 0 && (
            <details className="mb-3">
              <summary className="cursor-pointer text-xs font-medium text-muted hover:text-brand">
                {preview.parseErrors.length} Hinweise anzeigen
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">
                {preview.parseErrors.slice(0, 12).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </details>
          )}

          <PreviewTable orders={preview.orders} />
        </section>
      )}
    </div>
  );
}

function PreviewTable({ orders }: { orders: ShopifyPreviewOrder[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-2 pr-3">Bestellung</th>
            <th className="py-2 pr-3">Datum</th>
            <th className="py-2 pr-3">Kunde</th>
            <th className="py-2 pr-3 text-right">Betrag</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.externalId} className="border-b border-border/60">
              <td className="py-2 pr-3 font-medium whitespace-nowrap">
                {order.orderName}
              </td>
              <td className="py-2 pr-3 whitespace-nowrap">{order.date}</td>
              <td className="py-2 pr-3">
                <div className="min-w-40">
                  <p>{order.customerName ?? "—"}</p>
                  {order.email && (
                    <p className="text-xs text-muted">{order.email}</p>
                  )}
                </div>
              </td>
              <td className="py-2 pr-3 text-right whitespace-nowrap text-income">
                {formatEuro(order.amountCents)}
              </td>
              <td className="py-2">
                <StatusPill order={order} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ order }: { order: ShopifyPreviewOrder }) {
  if (order.importable) {
    return (
      <span className="rounded-full bg-income/10 px-2 py-0.5 text-xs font-medium text-income">
        Bereit
      </span>
    );
  }

  return (
    <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-muted">
      {order.skipReason ?? "Übersprungen"}
    </span>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
