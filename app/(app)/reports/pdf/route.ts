/**
 * EÜR-Jahresauswertung als PDF. Eigene Auth-Prüfung, da Route Handler nicht
 * vom (app)-Layout geschützt werden.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, categories, companyProfile, transactions } from "@/db/schema";
import { depreciationForYear, depreciationSchedule } from "@/lib/calc/afa";
import {
  profitAfterDepreciation,
  totalExpenses,
  totalIncome,
  type Booking,
} from "@/lib/calc/eur";
import { createClient } from "@/lib/supabase/server";
import { generateEurPdf } from "@/lib/pdf/eur-pdf";

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

  const [txRows, assetRows, profileRows] = await Promise.all([
    db
      .select({
        date: transactions.date,
        direction: transactions.direction,
        amount: transactions.amount,
        status: transactions.status,
        categoryName: categories.name,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.ownerId, user.id)),
    db.select().from(assets).where(eq(assets.ownerId, user.id)),
    db.select().from(companyProfile).limit(1),
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
  const profit = profitAfterDepreciation(bookings, year, depreciation);

  // Kategorie-Aufschlüsselung (nur aktive Buchungen des Jahres).
  const incomeMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();
  for (const row of txRows) {
    if (row.status === "cancelled" || Number(row.date.slice(0, 4)) !== year) {
      continue;
    }
    const label = row.categoryName ?? "Ohne Kategorie";
    const target = row.direction === "income" ? incomeMap : expenseMap;
    target.set(label, (target.get(label) ?? 0) + row.amount);
  }
  const toSorted = (m: Map<string, number>) =>
    Array.from(m, ([label, amount]) => ({ label, amount })).sort(
      (a, b) => b.amount - a.amount,
    );

  // Nur Anlagen mit AfA in diesem Jahr.
  const assetsDetail = assetRows
    .map((asset) => {
      const entry = depreciationSchedule(asset).find((e) => e.year === year);
      return {
        name: asset.name,
        purchaseDate: asset.purchaseDate,
        cost: asset.cost,
        afa: entry?.amount ?? 0,
        bookValueEnd: entry?.bookValueEnd ?? 0,
      };
    })
    .filter((a) => a.afa > 0);

  // Logo vom öffentlichen Asset laden (serverless-tauglich).
  let logo: Uint8Array | null = null;
  try {
    const res = await fetch(new URL("/logo.png", request.url));
    if (res.ok) logo = new Uint8Array(await res.arrayBuffer());
  } catch {
    /* Logo optional */
  }

  const profile = profileRows[0];
  const pdfBytes = await generateEurPdf({
    profile: {
      name: profile?.name ?? "EDGECO",
      address: profile?.address ?? null,
      steuernummer: profile?.steuernummer ?? null,
      iban: profile?.iban ?? null,
      kleinunternehmerHinweis: profile?.kleinunternehmerHinweis ?? null,
    },
    year,
    income,
    expenses,
    depreciation,
    profit,
    incomeCategories: toSorted(incomeMap),
    expenseCategories: toSorted(expenseMap),
    assets: assetsDetail,
    generatedAt: new Date().toISOString(),
    logo,
  });

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="edgeco-eur-${year}.pdf"`,
    },
  });
}
