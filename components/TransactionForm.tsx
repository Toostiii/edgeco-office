"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createTransaction, type ActionState } from "@/app/(app)/transactions/actions";

export type CategoryOption = {
  id: string;
  name: string;
  direction: "income" | "expense";
};

const today = new Date().toISOString().slice(0, 10);

export default function TransactionForm({
  categories,
}: {
  categories: CategoryOption[];
}) {
  const [direction, setDirection] = useState<"income" | "expense">("expense");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createTransaction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Nach erfolgreichem Speichern Felder leeren (Richtung beibehalten).
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  const visibleCategories = categories.filter((c) => c.direction === direction);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <h2 className="mb-4 text-sm font-semibold">Neue Buchung</h2>

      {/* Richtung */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setDirection("income")}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
            direction === "income"
              ? "border-income bg-income/10 text-income"
              : "border-border text-muted hover:bg-black/5"
          }`}
        >
          Einnahme
        </button>
        <button
          type="button"
          onClick={() => setDirection("expense")}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
            direction === "expense"
              ? "border-expense bg-expense/10 text-expense"
              : "border-border text-muted hover:bg-black/5"
          }`}
        >
          Ausgabe
        </button>
      </div>
      <input type="hidden" name="direction" value={direction} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Betrag (€)">
          <input
            name="amount"
            inputMode="decimal"
            required
            placeholder="82,50"
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>

        <Field label="Datum">
          <input
            name="date"
            type="date"
            required
            defaultValue={today}
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>

        <Field label="Kategorie">
          <select
            name="categoryId"
            className="w-full rounded-lg border border-border bg-white px-3 py-2 outline-none focus:border-brand"
          >
            <option value="">— ohne —</option>
            {visibleCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Zahlungsart">
          <select
            name="paymentMethod"
            className="w-full rounded-lg border border-border bg-white px-3 py-2 outline-none focus:border-brand"
          >
            <option value="">— wählen —</option>
            <option>Bar</option>
            <option>Überweisung</option>
            <option>PayPal</option>
            <option>Karte</option>
          </select>
        </Field>
      </div>

      <Field label="Beschreibung" className="mt-4">
        <input
          name="description"
          placeholder="z. B. Filament PETG 5kg"
          className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
        />
      </Field>

      {state.error && (
        <p className="mt-3 text-sm text-expense">{state.error}</p>
      )}
      {state.success && (
        <p className="mt-3 text-sm text-income">Buchung gespeichert ✓</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="brand-gradient mt-5 w-full rounded-lg py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Speichern …" : "Buchung speichern"}
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
