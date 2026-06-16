"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { travelExpenses, transactions, categories } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { parseEuroToCents } from "@/lib/money";
import { isYearLocked, yearOf } from "@/lib/fiscal";

export type ActionState = { error?: string; success?: boolean };

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  return user.id;
}

const travelSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum."),
  purpose: z.string().trim().min(1, "Zweck fehlt.").max(300),
  distanceKm: z.number().int().positive("Kilometer müssen > 0 sein."),
  ratePerKmCents: z.number().int().positive("Satz ungültig."),
});

export async function createTravelExpense(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  let ratePerKmCents = 30;
  try {
    const rateRaw = String(formData.get("ratePerKm") ?? "").trim();
    if (rateRaw) ratePerKmCents = parseEuroToCents(rateRaw);
  } catch {
    return { error: "Kilometersatz ist ungültig (z. B. 0,30)." };
  }

  const parsed = travelSchema.safeParse({
    date: String(formData.get("date") ?? ""),
    purpose: String(formData.get("purpose") ?? ""),
    distanceKm: parseInt(String(formData.get("distanceKm") ?? ""), 10),
    ratePerKmCents,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Eingabe ungültig." };
  }
  const data = parsed.data;
  const totalCents = data.distanceKm * data.ratePerKmCents;
  const book = formData.get("book") === "on";

  if (book && (await isYearLocked(ownerId, yearOf(data.date)))) {
    return {
      error: `Jahr ${yearOf(data.date)} ist festgeschrieben — keine Buchung möglich.`,
    };
  }

  let transactionId: string | null = null;
  if (book) {
    const cat = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.direction, "expense"),
          eq(categories.name, "Reisekosten"),
        ),
      )
      .limit(1);

    const inserted = await db
      .insert(transactions)
      .values({
        ownerId,
        direction: "expense",
        amount: totalCents,
        date: data.date,
        description: `Reisekosten: ${data.purpose} (${data.distanceKm} km)`,
        categoryId: cat[0]?.id ?? null,
        paymentMethod: "Kilometerpauschale",
      })
      .returning({ id: transactions.id });
    transactionId = inserted[0].id;
  }

  await db.insert(travelExpenses).values({
    ownerId,
    date: data.date,
    purpose: data.purpose,
    distanceKm: data.distanceKm,
    ratePerKmCents: data.ratePerKmCents,
    totalCents,
    transactionId,
  });

  revalidatePath("/reisekosten");
  if (book) {
    revalidatePath("/transactions");
    revalidatePath("/dashboard");
  }
  return { success: true };
}

export async function deleteTravelExpense(id: string): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  await db
    .delete(travelExpenses)
    .where(and(eq(travelExpenses.id, id), eq(travelExpenses.ownerId, ownerId)));

  revalidatePath("/reisekosten");
  return { success: true };
}
