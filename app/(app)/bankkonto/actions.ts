"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { isYearLocked, yearOf } from "@/lib/fiscal";

export type ImportState = {
  error?: string;
  success?: boolean;
  imported?: number;
  skipped?: number;
};

const rowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().max(300),
  amountCents: z.number().int(),
  categoryId: z.string().uuid().nullable().optional(),
});

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  return user.id;
}

/**
 * Importiert ausgewählte Bankzeilen als Buchungen. Vorzeichen bestimmt die
 * Richtung (positiv = Einnahme, negativ = Ausgabe), Betrag wird positiv
 * gespeichert. Zeilen mit Betrag 0 oder in gesperrten Jahren werden
 * übersprungen.
 */
export async function importBankRows(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    return { error: "Importdaten konnten nicht gelesen werden." };
  }

  const parsed = z.array(rowSchema).max(2000).safeParse(payload);
  if (!parsed.success) {
    return { error: "Importdaten sind ungültig." };
  }
  if (parsed.data.length === 0) {
    return { error: "Keine Zeilen zum Importieren ausgewählt." };
  }

  const lockedCache = new Map<number, boolean>();
  async function locked(year: number): Promise<boolean> {
    if (!lockedCache.has(year)) {
      lockedCache.set(year, await isYearLocked(ownerId, year));
    }
    return lockedCache.get(year)!;
  }

  const toInsert: (typeof transactions.$inferInsert)[] = [];
  let skipped = 0;
  for (const row of parsed.data) {
    if (row.amountCents === 0) {
      skipped++;
      continue;
    }
    if (await locked(yearOf(row.date))) {
      skipped++;
      continue;
    }
    toInsert.push({
      ownerId,
      date: row.date,
      direction: row.amountCents >= 0 ? "income" : "expense",
      amount: Math.abs(row.amountCents),
      description: row.description || "Bankumsatz",
      paymentMethod: "Überweisung",
      categoryId: row.categoryId ?? null,
    });
  }

  if (toInsert.length > 0) {
    await db.insert(transactions).values(toInsert);
  }

  revalidatePath("/bankkonto");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/reports");

  return {
    success: true,
    imported: toInsert.length,
    skipped,
  };
}
