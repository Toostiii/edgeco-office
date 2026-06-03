"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { parseEuroToCents } from "@/lib/money";
import { transactionSchema } from "@/lib/validation/transaction";

export type ActionState = { error?: string; success?: boolean };

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  return user.id;
}

export async function createTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  // Betrag parsen (deutsches/einfaches Format → Cent).
  let amountCents: number;
  try {
    amountCents = parseEuroToCents(String(formData.get("amount") ?? ""));
  } catch {
    return { error: "Betrag ist ungültig (z. B. 82,50)." };
  }

  const rawCategory = String(formData.get("categoryId") ?? "");
  const parsed = transactionSchema.safeParse({
    direction: formData.get("direction"),
    amountCents,
    date: String(formData.get("date") ?? ""),
    categoryId: rawCategory === "" ? null : rawCategory,
    description: String(formData.get("description") ?? ""),
    paymentMethod: String(formData.get("paymentMethod") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Eingabe ungültig." };
  }

  const data = parsed.data;
  await db.insert(transactions).values({
    ownerId,
    direction: data.direction,
    amount: data.amountCents,
    date: data.date,
    categoryId: data.categoryId ?? null,
    description: data.description || null,
    paymentMethod: data.paymentMethod || null,
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}

/** GoBD: nicht löschen, sondern stornieren. */
export async function cancelTransaction(id: string): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  await db
    .update(transactions)
    .set({ status: "cancelled" })
    .where(and(eq(transactions.id, id), eq(transactions.ownerId, ownerId)));

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}
