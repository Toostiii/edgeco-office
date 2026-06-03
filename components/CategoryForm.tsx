"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  createCategory,
  updateCategory,
  type ActionState,
} from "@/app/(app)/categories/actions";

export type EditCategory = {
  id: string;
  name: string;
  direction: "income" | "expense";
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
          defaultValue={editCategory?.direction ?? "expense"}
          className="w-full rounded-lg border border-border bg-white px-3 py-2 outline-none focus:border-brand"
        >
          <option value="expense">Ausgabe</option>
          <option value="income">Einnahme</option>
        </select>
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
