"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createTimeEntry,
  type ActionState,
} from "@/app/(app)/zeiterfassung/actions";
import { parseDurationToMinutes } from "@/lib/time";
import { formatEuro, parseEuroToCents } from "@/lib/money";

export type CustomerOption = { id: string; name: string };

const today = new Date().toISOString().slice(0, 10);

function safeCents(v: string): number {
  try {
    return v ? parseEuroToCents(v) : 0;
  } catch {
    return 0;
  }
}

export default function TimeEntryForm({
  customers,
}: {
  customers: CustomerOption[];
}) {
  const [duration, setDuration] = useState("");
  const [rate, setRate] = useState("");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createTimeEntry,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setDuration("");
      setRate("");
    }
  }, [state.success]);

  const minutes = parseDurationToMinutes(duration) ?? 0;
  const total = Math.round((minutes / 60) * safeCents(rate));

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <h2 className="mb-4 text-sm font-semibold">Neuer Zeiteintrag</h2>

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
        <Field label="Kunde">
          <select
            name="customerId"
            defaultValue=""
            className="w-full rounded-lg border border-border bg-white px-3 py-2 outline-none focus:border-brand"
          >
            <option value="">— ohne —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Dauer (h:min oder Std.)">
          <input
            name="duration"
            required
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="z. B. 1:30 oder 1,5"
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>
        <Field label="Stundensatz (€)">
          <input
            name="hourlyRate"
            inputMode="decimal"
            required
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="z. B. 80,00"
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>
      </div>

      <Field label="Beschreibung" className="mt-4">
        <input
          name="description"
          required
          placeholder="z. B. CAD-Konstruktion Halterung"
          className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
        />
      </Field>

      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm font-medium">Betrag</span>
        <span className="text-lg font-bold">{formatEuro(total)}</span>
      </div>

      {state.error && <p className="mt-3 text-sm text-expense">{state.error}</p>}
      {state.success && (
        <p className="mt-3 text-sm text-income">Zeiteintrag gespeichert ✓</p>
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
