/**
 * CSV-Export für die EÜR-Auswertung. Eigene Auth-Prüfung, da Route Handler
 * nicht vom (app)-Layout geschützt werden.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, categories, transactions } from "@/db/schema";
import { depreciationForYear } from "@/lib/calc/afa";
import {
  profitAfterDepreciation,
  totalExpenses,
  totalIncome,
  type Booking,
} from "@/lib/calc/eur";
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
        description: transactions.description,
        categoryName: categories.name,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.ownerId, user.id)),
    db
      .select()
      .from(assets)
      .where(eq(assets.ownerId, user.id)),
  ]);

  const bookings: Booking[] = txRows.map((row) => ({
    date: row.date,
    direction: row.direction,
    amount: row.amount,
    status: row.status,
  }));

  const income = totalIncome(bookings, year);
  const expenses = totalExpenses(bookings, year);
  const depreciation = assetRows.reduce(
    (sum, asset) => sum + depreciationForYear(asset, year),
    0,
  );
  const result = profitAfterDepreciation(bookings, year, depreciation);

  const rows: string[][] = [
    [
      "Typ",
      "Jahr",
      "Datum",
      "Kategorie",
      "Beschreibung",
      "Richtung",
      "Betrag (Cent)",
      "Betrag (EUR)",
    ],
    ["Zusammenfassung", String(year), "", "", "Einnahmen", "income", String(income), euro(income)],
    ["Zusammenfassung", String(year), "", "", "Ausgaben", "expense", String(expenses), euro(expenses)],
    ["Zusammenfassung", String(year), "", "", "AfA", "expense", String(depreciation), euro(depreciation)],
    ["Zusammenfassung", String(year), "", "", "Gewinn", "result", String(result), euro(result)],
  ];

  for (const row of txRows) {
    if (row.status === "cancelled" || Number(row.date.slice(0, 4)) !== year) {
      continue;
    }
    rows.push([
      "Buchung",
      String(year),
      row.date,
      row.categoryName ?? "Ohne Kategorie",
      row.description ?? "",
      row.direction,
      String(row.amount),
      euro(row.amount),
    ]);
  }

  for (const asset of assetRows) {
    const amount = depreciationForYear(asset, year);
    if (amount === 0) continue;
    rows.push([
      "AfA",
      String(year),
      asset.purchaseDate,
      "Abschreibung",
      asset.name,
      "expense",
      String(amount),
      euro(amount),
    ]);
  }

  const csv = rows.map((row) => row.map(csvCell).join(";")).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="edgeco-eur-${year}.csv"`,
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
