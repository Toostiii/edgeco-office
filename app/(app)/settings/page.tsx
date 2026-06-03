/**
 * Einstellungen — Firmenprofil für Rechnungen.
 */
import { db } from "@/db";
import { companyProfile } from "@/db/schema";
import SettingsForm, { type Profile } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const rows = await db.select().from(companyProfile).limit(1);
  const row = rows[0];

  const profile: Profile = {
    name: row?.name ?? "EDGECO",
    address: row?.address ?? null,
    steuernummer: row?.steuernummer ?? null,
    iban: row?.iban ?? null,
    kleinunternehmerHinweis: row?.kleinunternehmerHinweis ?? null,
    nextInvoiceNo: row?.nextInvoiceNo ?? 1,
  };

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold">Einstellungen</h1>
      <p className="mb-6 text-sm text-muted">
        Diese Daten erscheinen als Absender auf deinen Rechnungen.
      </p>
      <SettingsForm profile={profile} />

      <section className="mt-8 max-w-2xl rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold">Datensicherung</h2>
        <p className="mb-4 text-sm text-muted">
          Lade jederzeit ein vollständiges Backup all deiner Daten (Buchungen,
          Rechnungen, Kunden, Anlagen …) als JSON-Datei herunter. Empfehlung:
          regelmäßig sichern, z. B. monatlich.
        </p>
        <a
          href="/export"
          className="inline-block rounded-lg border border-brand px-5 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand/5"
        >
          ⬇ Alle Daten exportieren (JSON)
        </a>
        <p className="mt-3 text-xs text-muted">
          Hinweis: Die Beleg-Dateien selbst liegen im Supabase-Speicher; das
          Backup enthält deren Metadaten. Für die EÜR-Zahlen gibt es zusätzlich
          den CSV-Export unter „Auswertungen".
        </p>
      </section>
    </div>
  );
}
