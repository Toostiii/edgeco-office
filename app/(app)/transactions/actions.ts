"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { parseEuroToCents } from "@/lib/money";
import { isYearLocked, yearOf } from "@/lib/fiscal";
import {
  transactionSchema,
  splitTransactionSchema,
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

  if (await isYearLocked(ownerId, yearOf(data.date))) {
    return {
      error: `Jahr ${yearOf(data.date)} ist festgeschrieben — keine neuen Buchungen möglich.`,
    };
  }

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

  // Vorhandene Buchung laden, um ihr (altes) Jahr zu prüfen.
  const existing = await db
    .select({ date: transactions.date })
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.ownerId, ownerId)))
    .limit(1);
  if (!existing[0]) return { error: "Buchung nicht gefunden." };

  const oldYear = yearOf(existing[0].date);
  const newYear = yearOf(data.date);
  if (
    (await isYearLocked(ownerId, oldYear)) ||
    (await isYearLocked(ownerId, newYear))
  ) {
    return { error: "Betroffenes Jahr ist festgeschrieben — Änderung gesperrt." };
  }

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

/** Liest + validiert eine Splitbuchung (mehrere Kategorie/Betrag-Zeilen, JSON-codiert). */
function parseSplitForm(
  formData: FormData,
):
  | { data: ReturnType<typeof splitTransactionSchema.parse> }
  | { error: string } {
  let linesRaw: unknown;
  try {
    linesRaw = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    return { error: "Split-Zeilen sind ungültig." };
  }
  if (!Array.isArray(linesRaw)) return { error: "Split-Zeilen sind ungültig." };

  const lines: { amountCents: number; categoryId: string | null; description?: string }[] = [];
  for (const line of linesRaw as Array<{
    amount?: string;
    categoryId?: string;
    description?: string;
  }>) {
    let amountCents: number;
    try {
      amountCents = parseEuroToCents(String(line.amount ?? ""));
    } catch {
      return { error: "Ein Betrag in der Splitbuchung ist ungültig (z. B. 12,30)." };
    }
    lines.push({
      amountCents,
      categoryId: line.categoryId ? line.categoryId : null,
      description: line.description ?? "",
    });
  }

  const receiptRaw = String(formData.get("receiptId") ?? "");
  const parsed = splitTransactionSchema.safeParse({
    direction: formData.get("direction"),
    date: String(formData.get("date") ?? ""),
    receiptId: receiptRaw === "" ? null : receiptRaw,
    paymentMethod: String(formData.get("paymentMethod") ?? ""),
    lines,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Eingabe ungültig." };
  }
  return { data: parsed.data };
}

/**
 * Splitbuchung anlegen: ein Vorgang wird auf mehrere Kategorien aufgeteilt.
 * Jede Zeile wird als eigene Buchung gespeichert, alle teilen eine
 * gemeinsame splitGroupId zur späteren Zuordnung/Anzeige.
 */
export async function createSplitTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  const result = parseSplitForm(formData);
  if ("error" in result) return result;
  const data = result.data;

  if (await isYearLocked(ownerId, yearOf(data.date))) {
    return {
      error: `Jahr ${yearOf(data.date)} ist festgeschrieben — keine neuen Buchungen möglich.`,
    };
  }

  const splitGroupId = crypto.randomUUID();

  await db.insert(transactions).values(
    data.lines.map((line) => ({
      ownerId,
      direction: data.direction,
      amount: line.amountCents,
      date: data.date,
      categoryId: line.categoryId ?? null,
      receiptId: data.receiptId ?? null,
      description: line.description || null,
      paymentMethod: data.paymentMethod || null,
      splitGroupId,
    })),
  );

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}

/** Buchung endgültig löschen (für versehentliche Eingaben). */
export async function deleteTransaction(id: string): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  const existing = await db
    .select({ date: transactions.date })
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.ownerId, ownerId)))
    .limit(1);
  if (existing[0] && (await isYearLocked(ownerId, yearOf(existing[0].date)))) {
    return { error: "Jahr ist festgeschrieben — Löschen gesperrt." };
  }

  try {
    const deleted = await db
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.ownerId, ownerId)))
      .returning({ id: transactions.id });
    if (deleted.length === 0) {
      return { error: "Buchung nicht gefunden oder keine Berechtigung." };
    }
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Löschen fehlgeschlagen: ${err.message}`
          : "Löschen fehlgeschlagen.",
    };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}
