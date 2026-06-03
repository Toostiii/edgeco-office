"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  createTransaction,
  updateTransaction,
  type ActionState,
} from "@/app/(app)/transactions/actions";

export type CategoryOption = {
  id: string;
  name: string;
  direction: "income" | "expense";
};

export type ReceiptOption = { id: string; label: string };

export type EditTx = {
  id: string;
  direction: "income" | "expense";
  amount: number; // Cent
  date: string;
  categoryId: string | null;
  receiptId: string | null;
  description: string | null;
  paymentMethod: string | null;
};

const today = new Date().toISOString().slice(0, 10);

function centsToInput(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export type Prefill = {
  amount?: string;
  date?: string;
  receiptId?: string;
};

export default function TransactionForm({
  categories,
  receipts = [],
  editTx,
  prefill,
}: {
  categories: CategoryOption[];
  receipts?: ReceiptOption[];
  editTx?: EditTx;
  prefill?: Prefill;
}) {
  const isEdit = !!editTx;
  const [direction, setDirection] = useState<"income" | "expense">(
    editTx?.direction ?? "expense",
  );
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    isEdit ? updateTransaction : createTransaction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Im Anlegen-Modus nach Erfolg leeren (im Bearbeiten-Modus wird umgeleitet).
  useEffect(() => {
    if (!isEdit && state.success) formRef.current?.reset();
  }, [state.success, isEdit]);

  const visibleCategories = categories.filter((c) => c.direction === direction);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <h2 className="mb-4 text-sm font-semibold">
        {isEdit ? "Buchung bearbeiten" : "Neue Buchung"}
      </h2>

      {isEdit && <input type="hidden" name="id" value={editTx.id} />}

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
            defaultValue={editTx ? centsToInput(editTx.amount) : (prefill?.amount ?? "")}
            placeholder="82,50"
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>

        <Field label="Datum">
          <input
            name="date"
            type="date"
            required
            defaultValue={editTx?.date ?? prefill?.date ?? today}
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>

        <Field label="Kategorie">
          <select
            name="categoryId"
            defaultValue={editTx?.categoryId ?? ""}
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
            defaultValue={editTx?.paymentMethod ?? ""}
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
          defaultValue={editTx?.description ?? ""}
          placeholder="z. B. Filament PETG 5kg"
          className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
        />
      </Field>

      <Field label="Beleg (optional)" className="mt-4">
        <select
          name="receiptId"
          defaultValue={editTx?.receiptId ?? prefill?.receiptId ?? ""}
          className="w-full rounded-lg border border-border bg-white px-3 py-2 outline-none focus:border-brand"
        >
          <option value="">— kein Beleg —</option>
          {receipts.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </Field>

      {state.error && <p className="mt-3 text-sm text-expense">{state.error}</p>}
      {!isEdit && state.success && (
        <p className="mt-3 text-sm text-income">Buchung gespeichert ✓</p>
      )}

      <div className="mt-5 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="brand-gradient flex-1 rounded-lg py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending
            ? "Speichern …"
            : isEdit
              ? "Änderungen speichern"
              : "Buchung speichern"}
        </button>
        {isEdit && (
          <Link
            href="/transactions"
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-black/5"
          >
            Abbrechen
          </Link>
        )}
      </div>
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
