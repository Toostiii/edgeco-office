"use client";

import { useActionState } from "react";
import {
  updateCompanyProfile,
  type ActionState,
} from "@/app/(app)/settings/actions";

export type Profile = {
  name: string;
  address: string | null;
  steuernummer: string | null;
  iban: string | null;
  kleinunternehmerHinweis: string | null;
  nextInvoiceNo: number;
};

export default function SettingsForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateCompanyProfile,
    {},
  );

  return (
    <form
      action={formAction}
      className="max-w-2xl rounded-xl border border-border bg-card p-6 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Firmenname" className="sm:col-span-2">
          <input
            name="name"
            required
            defaultValue={profile.name}
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>

        <Field label="Adresse" className="sm:col-span-2">
          <textarea
            name="address"
            rows={3}
            defaultValue={profile.address ?? ""}
            placeholder="Straße Nr.&#10;PLZ Ort"
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>

        <Field label="Steuernummer">
          <input
            name="steuernummer"
            defaultValue={profile.steuernummer ?? ""}
            placeholder="12/345/67890"
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>

        <Field label="IBAN">
          <input
            name="iban"
            defaultValue={profile.iban ?? ""}
            placeholder="DE.."
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>

        <Field label="Nächste Rechnungsnummer">
          <input
            name="nextInvoiceNo"
            type="number"
            min={1}
            defaultValue={profile.nextInvoiceNo}
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>

        <Field label="Kleinunternehmer-Hinweis (§19)" className="sm:col-span-2">
          <textarea
            name="kleinunternehmerHinweis"
            rows={2}
            defaultValue={profile.kleinunternehmerHinweis ?? ""}
            className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </Field>
      </div>

      {state.error && <p className="mt-3 text-sm text-expense">{state.error}</p>}
      {state.success && (
        <p className="mt-3 text-sm text-income">Gespeichert ✓</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="brand-gradient mt-5 rounded-lg px-6 py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
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
