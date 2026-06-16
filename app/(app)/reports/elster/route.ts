/**
 * CSV-Export der "Anlage EÜR" — Buchungen nach offiziellen ELSTER-Kennzahlen
 * gruppiert. Eigene Auth-Prüfung, da Route Handler nicht vom (app)-Layout
 * geschützt werden.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, categories, transactions } from "@/db/schema";
import { depreciationForYear } from "@/lib/calc/afa";
import { buildElsterSummary } from "@/lib/calc/elster-eur";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const selectedYear = Number(url.searchParams.get("year"));
  const year = Number.isInteger(selectedYear)
    ? selectedYear
    : new Date().getFullYear();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Nicht angemeldet.", { status: 401 });

  const [txRows, assetRows] = await Promise.all([
    db
      .select({
        date: transactions.date,
        direction: transactions.direction,
        amount: transactions.amount,
        status: transactions.status,
        categoryKennzahl: categories.elsterKennzahl,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.ownerId, user.id)),
    db.select().from(assets).where(eq(assets.ownerId, user.id)),
  ]);

  const depreciation = assetRows.reduce(
    (sum, asset) => sum + depreciationForYear(asset, year),
    0,
  );

  const rowsForYear = txRows.filter(
    (row) => row.status !== "cancelled" && Number(row.date.slice(0, 4)) === year,
  );
  const summary = buildElsterSummary(
    rowsForYear.map((row) => ({
      direction: row.direction,
      amount: row.amount,
      categoryKennzahl: row.categoryKennzahl,
    })),
    depreciation,
  );

  const rows: string[][] = [["Zeile", "Kennzahl", "Bezeichnung", "Betrag (EUR)"]];
  for (const line of summary.lines) {
    rows.push([
      String(line.kennzahl.zeile),
      line.kennzahl.code,
      line.kennzahl.label,
      euro(line.amountCents),
    ]);
  }
  if (summary.unmappedIncomeCents > 0) {
    rows.push(["", "", "Nicht zugeordnet (Einnahmen)", euro(summary.unmappedIncomeCents)]);
  }
  if (summary.unmappedExpenseCents > 0) {
    rows.push(["", "", "Nicht zugeordnet (Ausgaben)", euro(summary.unmappedExpenseCents)]);
  }

  const csv = rows.map((row) => row.map(csvCell).join(";")).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="edgeco-anlage-euer-${year}.csv"`,
    },
  });
}

function euro(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function csvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}
