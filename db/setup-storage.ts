/**
 * Richtet die Storage-RLS-Policies für den privaten Bucket `belege` ein,
 * damit der angemeldete Inhaber Belege hochladen und lesen kann.
 * Ausführen mit:  npx tsx db/setup-storage.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

async function main() {
  console.log("→ Setze Storage-Policies für Bucket 'belege' …");

  await sql.unsafe(`
    drop policy if exists "edgeco_belege_insert" on storage.objects;
    create policy "edgeco_belege_insert" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'belege');

    drop policy if exists "edgeco_belege_select" on storage.objects;
    create policy "edgeco_belege_select" on storage.objects
      for select to authenticated
      using (bucket_id = 'belege');

    drop policy if exists "edgeco_belege_delete" on storage.objects;
    create policy "edgeco_belege_delete" on storage.objects
      for delete to authenticated
      using (bucket_id = 'belege');
  `);

  const policies = await sql`
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'edgeco_belege_%'
    order by policyname
  `;
  console.log(
    "  ✓ Policies aktiv:",
    policies.map((p) => p.policyname).join(", "),
  );

  await sql.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("Fehlgeschlagen:", err.message);
  await sql.end().catch(() => {});
  process.exit(1);
});
