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

  console.log("→ Seede Kategorien …");
  const existing = await db.query.categories.findMany();
  if (existing.length === 0) {
    await db.insert(categories).values([
      ...incomeCategories.map((name) => ({ name, direction: "income" as const })),
      ...expenseCategories.map((name) => ({
        name,
        direction: "expense" as const,
      })),
    ]);
    console.log(
      `  ✓ ${incomeCategories.length + expenseCategories.length} Kategorien angelegt`,
    );
  } else {
    console.log("  • Kategorien existieren bereits, übersprungen");
  }

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
