"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { recurringTransactions, transactions } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { parseEuroToCents } from "@/lib/money";
import { isYearLocked, yearOf } from "@/lib/fiscal";
import { nextDueDate } from "@/lib/recurring";

export type ActionState = { error?: string; success?: boolean };

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  return user.id;
}

const recurringSchema = z.object({
  direction: z.enum(["income", "expense"]),
  amountCents: z.number().int().positive("Betrag muss > 0 sein."),
  categoryId: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1, "Beschreibung fehlt.").max(300),
  paymentMethod: z.string().trim().max(100).optional().or(z.literal("")),
  frequency: z.enum(["monthly", "weekly", "yearly"]),
  dayOfMonth: z.number().int().min(1).max(28),
  nextDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum."),
});

export async function createRecurring(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  let amountCents = 0;
  try {
    amountCents = parseEuroToCents(String(formData.get("amount") ?? ""));
  } catch {
    return { error: "Betrag ist ungültig (z. B. 49,90)." };
  }

  const rawCategory = String(formData.get("categoryId") ?? "");
  const parsed = recurringSchema.safeParse({
    direction: formData.get("direction"),
    amountCents,
    categoryId: rawCategory === "" ? null : rawCategory,
    description: String(formData.get("description") ?? ""),
    paymentMethod: String(formData.get("paymentMethod") ?? ""),
    frequency: formData.get("frequency"),
    dayOfMonth: parseInt(String(formData.get("dayOfMonth") ?? "1"), 10) || 1,
    nextDue: String(formData.get("nextDue") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Eingabe ungültig." };
  }
  const data = parsed.data;

  await db.insert(recurringTransactions).values({
    ownerId,
    direction: data.direction,
    amount: data.amountCents,
    categoryId: data.categoryId ?? null,
    description: data.description,
    paymentMethod: data.paymentMethod || null,
    frequency: data.frequency,
    dayOfMonth: data.dayOfMonth,
    nextDue: data.nextDue,
    active: true,
  });

  revalidatePath("/wiederkehrend");
  return { success: true };
}

export async function deleteRecurring(id: string): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  try {
    const deleted = await db
      .delete(recurringTransactions)
      .where(
        and(
          eq(recurringTransactions.id, id),
          eq(recurringTransactions.ownerId, ownerId),
        ),
      )
      .returning({ id: recurringTransactions.id });
    if (deleted.length === 0) {
      return { error: "Vorlage nicht gefunden oder keine Berechtigung." };
    }
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Löschen fehlgeschlagen: ${err.message}`
          : "Löschen fehlgeschlagen.",
    };
  }

  revalidatePath("/wiederkehrend");
  return { success: true };
}

export async function toggleRecurring(id: string): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  const found = await db
    .select({ active: recurringTransactions.active })
    .from(recurringTransactions)
    .where(
      and(
        eq(recurringTransactions.id, id),
        eq(recurringTransactions.ownerId, ownerId),
      ),
    )
    .limit(1);
  if (!found[0]) return { error: "Vorlage nicht gefunden." };

  await db
    .update(recurringTransactions)
    .set({ active: !found[0].active })
    .where(
      and(
        eq(recurringTransactions.id, id),
        eq(recurringTransactions.ownerId, ownerId),
      ),
    );

  revalidatePath("/wiederkehrend");
  return { success: true };
}

/**
 * Bucht eine Transaktion aus der Vorlage (für nextDue-Datum) und setzt
 * nextDue auf die nächste Periode.
 */
export async function bookRecurring(id: string): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  const found = await db
    .select()
    .from(recurringTransactions)
    .where(
      and(
        eq(recurringTransactions.id, id),
        eq(recurringTransactions.ownerId, ownerId),
      ),
    )
    .limit(1);
  const tpl = found[0];
  if (!tpl) return { error: "Vorlage nicht gefunden." };

  const bookingDate = tpl.nextDue;
  if (await isYearLocked(ownerId, yearOf(bookingDate))) {
    return {
      error: `Jahr ${yearOf(bookingDate)} ist festgeschrieben — keine Buchung möglich.`,
    };
  }

  await db.insert(transactions).values({
    ownerId,
    direction: tpl.direction,
    amount: tpl.amount,
    date: bookingDate,
    description: tpl.description,
    categoryId: tpl.categoryId ?? null,
    paymentMethod: tpl.paymentMethod ?? null,
  });

  const next = nextDueDate(
    bookingDate,
    tpl.frequency,
    tpl.dayOfMonth ?? 1,
  );
  await db
    .update(recurringTransactions)
    .set({ nextDue: next })
    .where(eq(recurringTransactions.id, id));

  revalidatePath("/wiederkehrend");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}
