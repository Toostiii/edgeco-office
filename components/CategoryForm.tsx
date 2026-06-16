"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { useState } from "react";
import {
  createCategory,
  updateCategory,
  type ActionState,
} from "@/app/(app)/categories/actions";
import { kennzahlOptions } from "@/lib/elster";

export type EditCategory = {
  id: string;
  name: string;
  direction: "income" | "expense";
  elsterKennzahl: string | null;
};

export default function CategoryForm({
  editCategory,
}: {
  editCategory?: EditCategory;
}) {
  const isEdit = !!editCategory;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    isEdit ? updateCategory : createCategory,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [direction, setDirection] = useState<"income" | "expense">(
    editCategory?.direction ?? "expense",
  );

  useEffect(() => {
    if (!isEdit && state.success) {
      formRef.current?.reset();
      setDirection("expense");
    }
  }, [state.success, isEdit]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <h2 className="mb-4 text-sm font-semibold">
        {isEdit ? "Kategorie bearbeiten" : "Neue Kategorie"}
      </h2>

      {isEdit && <input type="hidden" name="id" value={editCategory.id} />}

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Bezeichnung</span>
        <input
          name="name"
          required
          defaultValue={editCategory?.name ?? ""}
          placeholder="z. B. Material, Versand, Verkaufserlöse"
          className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-medium">Art</span>
        <select
          name="direction"
          value={direction}
          onChange={(e) => setDirection(e.target.value as "income" | "expense")}
          className="w-full rounded-lg border border-border bg-white px-3 py-2 outline-none focus:border-brand"
        >
          <option value="expense">Ausgabe</option>
          <option value="income">Einnahme</option>
        </select>
      </label>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-medium">
          Anlage-EÜR-Zeile (ELSTER)
        </span>
        <select
          name="elsterKennzahl"
          defaultValue={editCategory?.elsterKennzahl ?? ""}
          className="w-full rounded-lg border border-border bg-white px-3 py-2 outline-none focus:border-brand"
        >
          <option value="">— nicht zugeordnet —</option>
          {kennzahlOptions(direction).map((k) => (
            <option key={k.code} value={k.code}>
              Zeile {k.zeile} — {k.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-muted">
          Ordnet die Kategorie der offiziellen Anlage-EÜR-Zeile zu (siehe
          Auswertungen → Anlage EÜR).
        </span>
      </label>

      {state.error && <p className="mt-3 text-sm text-expense">{state.error}</p>}
      {!isEdit && state.success && (
        <p className="mt-3 text-sm text-income">Kategorie gespeichert ✓</p>
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
              : "Kategorie speichern"}
        </button>
        {isEdit && (
          <Link
            href="/categories"
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-black/5"
          >
            Abbrechen
          </Link>
        )}
      </div>
    </form>
  );
}
