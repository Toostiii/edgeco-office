/**
 * Seed: Standard-EÜR-Kategorien + leeres Firmenprofil.
 * Ausführen mit:  npm run db:seed   (benötigt DATABASE_URL in .env.local)
 *
 * Hinweis: dotenv MUSS vor dem Import des DB-Clients laufen. Da ES-Module-
 * Imports gehoisted werden, importieren wir db/schema erst dynamisch
 * innerhalb von seed().
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const incomeCategories = [
  "Verkauf Teile (Shopify)",
  "Verkauf Auftragsfertigung",
  "Sonstige Einnahmen",
];

const expenseCategories = [
  "Material / Wareneinkauf",
  "Verpackung",
  "Versand",
  "Werkzeug / Kleingeräte (GWG)",
  "Software / Lizenzen",
  "Marketing",
  "Bürokosten",
  "Reisekosten",
  "Abschreibung (AfA)",
];

async function seed() {
  const { db } = await import("./index");
  const { categories, companyProfile } = await import("./schema");
  const { and, eq, isNull } = await import("drizzle-orm");
  const { DEFAULT_CATEGORY_KENNZAHL } = await import("../lib/elster");

  console.log("→ Seede Kategorien …");
  const existing = await db.query.categories.findMany();
  if (existing.length === 0) {
    await db.insert(categories).values([
      ...incomeCategories.map((name) => ({
        name,
        direction: "income" as const,
        elsterKennzahl: DEFAULT_CATEGORY_KENNZAHL[name] ?? null,
      })),
      ...expenseCategories.map((name) => ({
        name,
        direction: "expense" as const,
        elsterKennzahl: DEFAULT_CATEGORY_KENNZAHL[name] ?? null,
      })),
    ]);
    console.log(
      `  ✓ ${incomeCategories.length + expenseCategories.length} Kategorien angelegt`,
    );
  } else {
    console.log("  • Kategorien existieren bereits, übersprungen");
  }

  console.log("→ Ordne bestehenden Kategorien ohne ELSTER-Kennzahl eine Zeile zu …");
  let backfilled = 0;
  for (const [name, kennzahl] of Object.entries(DEFAULT_CATEGORY_KENNZAHL)) {
    const result = await db
      .update(categories)
      .set({ elsterKennzahl: kennzahl })
      .where(and(eq(categories.name, name), isNull(categories.elsterKennzahl)))
      .returning({ id: categories.id });
    backfilled += result.length;
  }
  console.log(`  ✓ ${backfilled} Kategorien mit Standard-Kennzahl ergänzt`);

  console.log("→ Prüfe Firmenprofil …");
  const profile = await db.query.companyProfile.findFirst();
  if (!profile) {
    await db.insert(companyProfile).values({ name: "EDGECO" });
    console.log("  ✓ Firmenprofil angelegt (bitte in Einstellungen ergänzen)");
  } else {
    console.log("  • Firmenprofil existiert bereits");
  }

  console.log("Fertig.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed fehlgeschlagen:", err);
  process.exit(1);
});
