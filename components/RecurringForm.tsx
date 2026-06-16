"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createRecurring,
  type ActionState,
} from "@/app/(app)/wiederkehrend/actions";

export interface CategoryOption {
  id: string;
  name: string;
  direction: "income" | "expense";
}

const today = new Date().toISOString().slice(0, 10);

export default function RecurringForm({
  categories,
}: {
  categories: CategoryOption[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createRecurring,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <h2 className="mb-4 text-sm font-semibold">Neue Vorlage</h2>

      <div className="grid grid-cols-1 gap-4">
        <Field label="Richtung">
          <select
            name="direction"
            required
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          >
            <option value="expense">Ausgabe</option>
            <option value="income">Einnahme</option>
          </select>
        </Field>
        <Field label="Beschreibung">
          <input
            name="description"
            required
            placeholder="z. B. Software-Abo"
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>
        <Field label="Betrag (€)">
          <input
            name="amount"
            inputMode="decimal"
            required
            placeholder="z. B. 9,99"
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>
        <Field label="Kategorie">
          <select
            name="categoryId"
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          >
            <option value="">— ohne —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Zahlungsmethode">
          <input
            name="paymentMethod"
            placeholder="z. B. Überweisung"
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>
        <Field label="Frequenz">
          <select
            name="frequency"
            required
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          >
            <option value="monthly">Monatlich</option>
            <option value="weekly">Wöchentlich</option>
            <option value="yearly">Jährlich</option>
          </select>
        </Field>
        <Field label="Tag im Monat (1–28)">
          <input
            name="dayOfMonth"
            type="number"
            min={1}
            max={28}
            defaultValue={1}
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>
        <Field label="Erste Fälligkeit">
          <input
            name="nextDue"
            type="date"
            required
            defaultValue={today}
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>
      </div>

      {state.error && <p className="mt-3 text-sm text-expense">{state.error}</p>}
      {state.success && (
        <p className="mt-3 text-sm text-income">Vorlage gespeichert ✓</p>
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
