/**
 * Sicherheits-Härtung: aktiviert Row-Level-Security (RLS) auf allen
 * App-Tabellen. Damit ist die öffentliche Supabase-REST-API (Anon-Key)
 * gesperrt — es gibt bewusst KEINE Policies, weil die App ausschließlich
 * über die privilegierte DATABASE_URL-Verbindung zugreift (umgeht RLS).
 *
 * Ausführen mit:  npm run db:secure
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

const tables = [
  "company_profile",
  "categories",
  "receipts",
  "customers",
  "assets",
  "invoices",
  "invoice_items",
  "transactions",
];

async function main() {
  console.log("→ Aktiviere Row-Level-Security …");
  for (const t of tables) {
    await sql.unsafe(
      `alter table public.${t} enable row level security;`,
    );
    console.log(`  ✓ ${t}`);
  }

  const rls = await sql`
    select relname, relrowsecurity
    from pg_class
    where relname = any(${tables}) and relkind = 'r'
    order by relname
  `;
  const offen = rls.filter((r) => !r.relrowsecurity).map((r) => r.relname);
  console.log(
    offen.length === 0
      ? "Alle Tabellen abgesichert. Öffentliche REST-API ist gesperrt."
      : `WARNUNG: noch offen: ${offen.join(", ")}`,
  );

  await sql.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("Fehlgeschlagen:", err.message);
  await sql.end().catch(() => {});
  process.exit(1);
});
