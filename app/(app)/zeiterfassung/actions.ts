"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { timeEntries } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { parseEuroToCents } from "@/lib/money";
import { parseDurationToMinutes } from "@/lib/time";

export type ActionState = { error?: string; success?: boolean };

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  return user.id;
}

const entrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum."),
  customerId: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1, "Beschreibung fehlt.").max(300),
  minutes: z.number().int().positive("Dauer muss > 0 sein."),
  hourlyRateCents: z.number().int().positive("Stundensatz ungültig."),
});

export async function createTimeEntry(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  const minutes = parseDurationToMinutes(String(formData.get("duration") ?? ""));
  if (minutes === null) {
    return { error: "Dauer ungültig (z. B. 1:30 oder 1,5)." };
  }

  let hourlyRateCents = 0;
  try {
    hourlyRateCents = parseEuroToCents(String(formData.get("hourlyRate") ?? ""));
  } catch {
    return { error: "Stundensatz ungültig (z. B. 80,00)." };
  }

  const rawCustomer = String(formData.get("customerId") ?? "");
  const parsed = entrySchema.safeParse({
    date: String(formData.get("date") ?? ""),
    customerId: rawCustomer === "" ? null : rawCustomer,
    description: String(formData.get("description") ?? ""),
    minutes,
    hourlyRateCents,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Eingabe ungültig." };
  }
  const data = parsed.data;
  const totalCents = Math.round((data.minutes / 60) * data.hourlyRateCents);

  await db.insert(timeEntries).values({
    ownerId,
    date: data.date,
    customerId: data.customerId ?? null,
    description: data.description,
    minutes: data.minutes,
    hourlyRateCents: data.hourlyRateCents,
    totalCents,
    status: "open",
  });

  revalidatePath("/zeiterfassung");
  return { success: true };
}

export async function deleteTimeEntry(id: string): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  // Nur offene Einträge dürfen gelöscht werden.
  const found = await db
    .select({ status: timeEntries.status })
    .from(timeEntries)
    .where(and(eq(timeEntries.id, id), eq(timeEntries.ownerId, ownerId)))
    .limit(1);
  if (!found[0]) return { error: "Eintrag nicht gefunden." };
  if (found[0].status !== "open") {
    return { error: "Abgerechnete Einträge können nicht gelöscht werden." };
  }

  await db
    .delete(timeEntries)
    .where(and(eq(timeEntries.id, id), eq(timeEntries.ownerId, ownerId)));

  revalidatePath("/zeiterfassung");
  return { success: true };
}

export async function markInvoiced(ids: string[]): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  if (ids.length === 0) return { error: "Keine Einträge ausgewählt." };

  await db
    .update(timeEntries)
    .set({ status: "invoiced" })
    .where(
      and(eq(timeEntries.ownerId, ownerId), inArray(timeEntries.id, ids)),
    );

  revalidatePath("/zeiterfassung");
  return { success: true };
}
