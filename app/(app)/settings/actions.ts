"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companyProfile } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; success?: boolean };

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  return user.id;
}

export async function updateCompanyProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Firmenname ist erforderlich." };

  const nextInvoiceNo = parseInt(
    String(formData.get("nextInvoiceNo") ?? "1"),
    10,
  );

  const values = {
    name,
    address: String(formData.get("address") ?? "").trim() || null,
    steuernummer: String(formData.get("steuernummer") ?? "").trim() || null,
    iban: String(formData.get("iban") ?? "").trim() || null,
    kleinunternehmerHinweis:
      String(formData.get("kleinunternehmerHinweis") ?? "").trim() ||
      "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmer).",
    nextInvoiceNo:
      Number.isNaN(nextInvoiceNo) || nextInvoiceNo < 1 ? 1 : nextInvoiceNo,
  };

  // Es gibt genau ein Firmenprofil — vorhandenes aktualisieren oder anlegen.
  const existing = await db.select().from(companyProfile).limit(1);
  if (existing[0]) {
    await db
      .update(companyProfile)
      .set(values)
      .where(eq(companyProfile.id, existing[0].id));
  } else {
    await db.insert(companyProfile).values({ ...values, ownerId });
  }

  revalidatePath("/settings");
  return { success: true };
}
