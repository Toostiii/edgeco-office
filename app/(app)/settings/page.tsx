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
    </div>
  );
}
