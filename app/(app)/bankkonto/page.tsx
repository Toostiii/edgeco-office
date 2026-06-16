/**
 * Bankkonto-Import — Kontoauszug als CSV einlesen und als Buchungen anlegen.
 */
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import BankImportForm, {
  type CategoryOption,
} from "@/components/BankImportForm";

export const dynamic = "force-dynamic";

export default async function BankkontoPage() {
  const cats = (await db
    .select({
      id: categories.id,
      name: categories.name,
      direction: categories.direction,
    })
    .from(categories)
    .orderBy(asc(categories.name))) as CategoryOption[];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold">Bankkonto-Import</h1>
      <p className="mb-6 text-sm text-muted">
        Exportiere deinen Kontoauszug als CSV-Datei aus deinem Online-Banking
        und lade sie hier hoch. Unterstützt werden gängige Formate von{" "}
        <strong>Sparkasse</strong>, <strong>ING</strong>, <strong>N26</strong>{" "}
        und <strong>Deutsche Bank</strong> — andere Banken werden über eine
        automatische Erkennung von Datum und Betrag eingelesen.
      </p>

      <BankImportForm categories={cats} />
    </div>
  );
}
