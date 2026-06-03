"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { parseEuroToCents } from "@/lib/money";
import {
  transactionSchema,
  type TransactionInput,
} from "@/lib/validation/transaction";

export type ActionState = { error?: string; success?: boolean };

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  return user.id;
}

/** Liest + validiert die Formularfelder einer Buchung. */
function parseForm(
  formData: FormData,
): { data: TransactionInput } | { error: string } {
  let amountCents: number;
  try {
    amountCents = parseEuroToCents(String(formData.get("amount") ?? ""));
  } catch {
    return { error: "Betrag ist ungültig (z. B. 82,50)." };
  }

  const rawCategory = String(formData.get("categoryId") ?? "");
  const rawReceipt = String(formData.get("receiptId") ?? "");
  const parsed = transactionSchema.safeParse({
    direction: formData.get("direction"),
    amountCents,
    date: String(formData.get("date") ?? ""),
    categoryId: rawCategory === "" ? null : rawCategory,
    receiptId: rawReceipt === "" ? null : rawReceipt,
    description: String(formData.get("description") ?? ""),
    paymentMethod: String(formData.get("paymentMethod") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Eingabe ungültig." };
  }
  return { data: parsed.data };
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

  const result = parseForm(formData);
  if ("error" in result) return result;
  const data = result.data;

  await db.insert(transactions).values({
    ownerId,
    direction: data.direction,
    amount: data.amountCents,
    date: data.date,
    categoryId: data.categoryId ?? null,
    receiptId: data.receiptId ?? null,
    description: data.description || null,
    paymentMethod: data.paymentMethod || null,
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Keine Buchung ausgewählt." };

  const result = parseForm(formData);
  if ("error" in result) return result;
  const data = result.data;

  await db
    .update(transactions)
    .set({
      direction: data.direction,
      amount: data.amountCents,
      date: data.date,
      categoryId: data.categoryId ?? null,
      receiptId: data.receiptId ?? null,
      description: data.description || null,
      paymentMethod: data.paymentMethod || null,
    })
    .where(and(eq(transactions.id, id), eq(transactions.ownerId, ownerId)));

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  // Bearbeitungsmodus verlassen.
  redirect("/transactions");
}

/** Buchung endgültig löschen (für versehentliche Eingaben). */
export async function deleteTransaction(id: string): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.ownerId, ownerId)));

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}
