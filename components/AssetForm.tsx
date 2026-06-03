"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  createAsset,
  updateAsset,
  type ActionState,
} from "@/app/(app)/assets/actions";

export type EditAsset = {
  id: string;
  name: string;
  purchaseDate: string;
  cost: number;
  usefulLifeYears: number;
};

function centsToInput(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function AssetForm({ editAsset }: { editAsset?: EditAsset }) {
  const isEdit = !!editAsset;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    isEdit ? updateAsset : createAsset,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!isEdit && state.success) formRef.current?.reset();
  }, [state.success, isEdit]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <h2 className="mb-4 text-sm font-semibold">
        {isEdit ? "Anlage bearbeiten" : "Neue Anlage"}
      </h2>

      {isEdit && <input type="hidden" name="id" value={editAsset.id} />}

      <Field label="Name">
        <input
          name="name"
          required
          defaultValue={editAsset?.name ?? ""}
          placeholder="z. B. Bambu Lab X1 Carbon"
          className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
        />
      </Field>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Anschaffung">
          <input
            name="purchaseDate"
            type="date"
            required
            defaultValue={editAsset?.purchaseDate ?? new Date().toISOString().slice(0, 10)}
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>

        <Field label="Nutzungsdauer">
          <input
            name="usefulLifeYears"
            type="number"
            min={1}
            max={50}
            step={1}
            required
            defaultValue={editAsset?.usefulLifeYears ?? 3}
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>
      </div>

      <Field label="Anschaffungskosten (€)" className="mt-4">
        <input
          name="cost"
          inputMode="decimal"
          required
          defaultValue={editAsset ? centsToInput(editAsset.cost) : ""}
          placeholder="1.250,00"
          className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
        />
      </Field>

      {state.error && <p className="mt-3 text-sm text-expense">{state.error}</p>}
      {!isEdit && state.success && (
        <p className="mt-3 text-sm text-income">Anlage gespeichert ✓</p>
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
              : "Anlage speichern"}
        </button>
        {isEdit && (
          <Link
            href="/assets"
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
