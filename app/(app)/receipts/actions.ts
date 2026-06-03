"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { receipts, transactions } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  return user.id;
}

/**
 * Löscht einen Beleg: entkoppelt ihn von eventuellen Buchungen, entfernt die
 * Datei aus dem Storage und löscht den DB-Eintrag.
 */
export async function deleteReceipt(
  id: string,
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sitzung abgelaufen. Bitte neu anmelden." };

  const found = await db
    .select({ filePath: receipts.filePath })
    .from(receipts)
    .where(and(eq(receipts.id, id), eq(receipts.ownerId, user.id)))
    .limit(1);

  if (!found[0]) return { error: "Beleg nicht gefunden." };

  // Verknüpfte Buchungen lösen (Buchung bleibt erhalten, nur ohne Beleg).
  await db
    .update(transactions)
    .set({ receiptId: null })
    .where(
      and(
        eq(transactions.receiptId, id),
        eq(transactions.ownerId, user.id),
      ),
    );

  // Datei aus dem Storage entfernen.
  await supabase.storage.from("belege").remove([found[0].filePath]);

  // DB-Eintrag löschen.
  await db
    .delete(receipts)
    .where(and(eq(receipts.id, id), eq(receipts.ownerId, user.id)));

  revalidatePath("/receipts");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Speichert die Metadaten eines hochgeladenen Belegs.
 * Die Datei selbst liegt bereits in Supabase Storage (Upload im Browser),
 * hier wird nur der DB-Eintrag mit GoBD-Hash angelegt.
 */
export async function createReceipt(input: {
  filePath: string;
  fileHash: string;
  note?: string;
}): Promise<{ error?: string; success?: boolean }> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  if (!input.filePath) return { error: "Kein Dateipfad." };

  await db.insert(receipts).values({
    ownerId,
    filePath: input.filePath,
    fileHash: input.fileHash || null,
    note: input.note?.trim() || null,
  });

  revalidatePath("/receipts");
  revalidatePath("/transactions");
  return { success: true };
}
