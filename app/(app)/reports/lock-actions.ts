"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { fiscalLocks } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { isYearLocked } from "@/lib/fiscal";

export type LockState = { error?: string; success?: boolean };

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  return user.id;
}

/** Jahr festschreiben (GoBD): danach sind Buchungen dieses Jahres gesperrt. */
export async function lockYear(year: number): Promise<LockState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }
  if (!Number.isInteger(year)) return { error: "Ungültiges Jahr." };

  if (!(await isYearLocked(ownerId, year))) {
    await db.insert(fiscalLocks).values({ ownerId, year });
  }
  revalidatePath("/reports");
  return { success: true };
}

/** Festschreibung aufheben (nur in Ausnahmefällen — GoBD rät davon ab). */
export async function unlockYear(year: number): Promise<LockState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }
  await db
    .delete(fiscalLocks)
    .where(and(eq(fiscalLocks.ownerId, ownerId), eq(fiscalLocks.year, year)));
  revalidatePath("/reports");
  return { success: true };
}
