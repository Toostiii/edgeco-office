"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  createCustomer,
  updateCustomer,
  type ActionState,
} from "@/app/(app)/customers/actions";

export type EditCustomer = {
  id: string;
  name: string;
  address: string | null;
  email: string | null;
};

export default function CustomerForm({
  editCustomer,
}: {
  editCustomer?: EditCustomer;
}) {
  const isEdit = !!editCustomer;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    isEdit ? updateCustomer : createCustomer,
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
        {isEdit ? "Kunde bearbeiten" : "Neuer Kunde"}
      </h2>

      {isEdit && <input type="hidden" name="id" value={editCustomer.id} />}

      <Field label="Name / Firma">
        <input
          name="name"
          required
          defaultValue={editCustomer?.name ?? ""}
          placeholder="z. B. Max Mustermann"
          className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
        />
      </Field>

      <Field label="Adresse" className="mt-4">
        <textarea
          name="address"
          rows={3}
          defaultValue={editCustomer?.address ?? ""}
          placeholder="Straße Nr.&#10;PLZ Ort"
          className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
        />
      </Field>

      <Field label="E-Mail (optional)" className="mt-4">
        <input
          name="email"
          type="email"
          defaultValue={editCustomer?.email ?? ""}
          placeholder="kunde@example.de"
          className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
        />
      </Field>

      {state.error && <p className="mt-3 text-sm text-expense">{state.error}</p>}
      {!isEdit && state.success && (
        <p className="mt-3 text-sm text-income">Kunde gespeichert ✓</p>
      )}

      <div className="mt-5 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="brand-gradient flex-1 rounded-lg py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Speichern …" : isEdit ? "Änderungen speichern" : "Kunde speichern"}
        </button>
        {isEdit && (
          <Link
            href="/customers"
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
