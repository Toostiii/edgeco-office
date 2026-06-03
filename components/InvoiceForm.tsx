"use client";

import { useActionState, useState } from "react";
import { createInvoice, type ActionState } from "@/app/(app)/invoices/actions";
import { formatEuro, parseEuroToCents } from "@/lib/money";

export type CustomerOption = { id: string; name: string };

type Line = { description: string; quantity: string; unitPrice: string };

const emptyLine: Line = { description: "", quantity: "1", unitPrice: "" };
const today = new Date().toISOString().slice(0, 10);

function safeCents(v: string): number {
  try {
    return v ? parseEuroToCents(v) : 0;
  } catch {
    return 0;
  }
}

export default function InvoiceForm({
  customers,
}: {
  customers: CustomerOption[];
}) {
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createInvoice,
    {},
  );

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((ls) => [...ls, { ...emptyLine }]);
  }
  function removeLine(i: number) {
    setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));
  }

  const total = lines.reduce(
    (sum, l) => sum + (parseInt(l.quantity || "1", 10) || 0) * safeCents(l.unitPrice),
    0,
  );

  return (
    <form
      action={formAction}
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <h2 className="mb-4 text-sm font-semibold">Neue Rechnung</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Kunde</span>
          <select
            name="customerId"
            required
            defaultValue=""
            className="w-full rounded-lg border border-border bg-white px-3 py-2 outline-none focus:border-brand"
          >
            <option value="" disabled>
              — Kunde wählen —
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Rechnungsdatum</span>
          <input
            name="date"
            type="date"
            required
            defaultValue={today}
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </label>
      </div>

      <div className="mt-5">
        <span className="mb-2 block text-sm font-medium">Positionen</span>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex gap-2">
              <input
                name="description"
                value={l.description}
                onChange={(e) => updateLine(i, { description: e.target.value })}
                placeholder="Beschreibung"
                className="min-w-0 flex-1 rounded-lg border border-border px-2 py-2 text-sm outline-none focus:border-brand"
              />
              <input
                name="quantity"
                type="number"
                min={1}
                value={l.quantity}
                onChange={(e) => updateLine(i, { quantity: e.target.value })}
                className="w-16 rounded-lg border border-border px-2 py-2 text-sm outline-none focus:border-brand"
                title="Menge"
              />
              <input
                name="unitPrice"
                inputMode="decimal"
                value={l.unitPrice}
                onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                placeholder="Preis €"
                className="w-24 rounded-lg border border-border px-2 py-2 text-sm outline-none focus:border-brand"
                title="Einzelpreis"
              />
              <button
                type="button"
                onClick={() => removeLine(i)}
                className="px-1 text-muted hover:text-expense"
                title="Position entfernen"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addLine}
          className="mt-2 text-sm font-medium text-brand hover:underline"
        >
          + Position hinzufügen
        </button>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm font-medium">Gesamtbetrag</span>
        <span className="text-lg font-bold">{formatEuro(total)}</span>
      </div>
      <p className="mt-1 text-right text-xs text-muted">
        Kleinunternehmer §19 UStG — keine USt.
      </p>

      {state.error && <p className="mt-3 text-sm text-expense">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="brand-gradient mt-4 w-full rounded-lg py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Speichern …" : "Rechnung erstellen"}
      </button>
    </form>
  );
}
