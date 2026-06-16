"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createTravelExpense,
  type ActionState,
} from "@/app/(app)/reisekosten/actions";
import { formatEuro, parseEuroToCents } from "@/lib/money";

const today = new Date().toISOString().slice(0, 10);

function safeCents(v: string): number {
  try {
    return v ? parseEuroToCents(v) : 0;
  } catch {
    return 0;
  }
}

export default function TravelExpenseForm() {
  const [km, setKm] = useState("");
  const [rate, setRate] = useState("0,30");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createTravelExpense,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setKm("");
      setRate("0,30");
    }
  }, [state.success]);

  const total = (parseInt(km || "0", 10) || 0) * safeCents(rate);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <h2 className="mb-4 text-sm font-semibold">Neue Reisekosten</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Datum">
          <input
            name="date"
            type="date"
            required
            defaultValue={today}
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>
        <Field label="Zweck">
          <input
            name="purpose"
            required
            placeholder="z. B. Kundenbesuch München"
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>
        <Field label="Kilometer">
          <input
            name="distanceKm"
            type="number"
            min={1}
            required
            value={km}
            onChange={(e) => setKm(e.target.value)}
            placeholder="z. B. 120"
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>
        <Field label="Satz (€/km)">
          <input
            name="ratePerKm"
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" name="book" defaultChecked />
        Direkt als Betriebsausgabe (Reisekosten) buchen
      </label>

      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm font-medium">Betrag</span>
        <span className="text-lg font-bold">{formatEuro(total)}</span>
      </div>

      {state.error && <p className="mt-3 text-sm text-expense">{state.error}</p>}
      {state.success && (
        <p className="mt-3 text-sm text-income">Reisekosten gespeichert ✓</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="brand-gradient mt-4 w-full rounded-lg py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Speichern …" : "Speichern"}
      </button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
