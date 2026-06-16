"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, transactions } from "@/db/schema";
import { parseEuroToCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { assetSchema, type AssetInput } from "@/lib/validation/asset";

export type ActionState = { error?: string; success?: boolean };

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  return user.id;
}

function parseForm(formData: FormData): { data: AssetInput } | { error: string } {
  let costCents: number;
  try {
    costCents = parseEuroToCents(String(formData.get("cost") ?? ""));
  } catch {
    return { error: "Anschaffungskosten sind ungültig (z. B. 1.250,00)." };
  }

  const usefulLifeYears = Number(formData.get("usefulLifeYears"));
  const parsed = assetSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    purchaseDate: String(formData.get("purchaseDate") ?? ""),
    costCents,
    usefulLifeYears,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Eingabe ungültig." };
  }
  return { data: parsed.data };
}

export async function createAsset(
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

  await db.insert(assets).values({
    ownerId,
    name: data.name,
    purchaseDate: data.purchaseDate,
    cost: data.costCents,
    usefulLifeYears: data.usefulLifeYears,
    method: "linear",
  });

  revalidatePath("/assets");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateAsset(
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
  if (!id) return { error: "Keine Anlage ausgewählt." };

  const result = parseForm(formData);
  if ("error" in result) return result;
  const data = result.data;

  await db
    .update(assets)
    .set({
      name: data.name,
      purchaseDate: data.purchaseDate,
      cost: data.costCents,
      usefulLifeYears: data.usefulLifeYears,
      method: "linear",
    })
    .where(and(eq(assets.id, id), eq(assets.ownerId, ownerId)));

  revalidatePath("/assets");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
  redirect("/assets");
}

export async function deleteAsset(id: string): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  try {
    await db
      .update(transactions)
      .set({ assetId: null })
      .where(and(eq(transactions.assetId, id), eq(transactions.ownerId, ownerId)));

    const deleted = await db
      .delete(assets)
      .where(and(eq(assets.id, id), eq(assets.ownerId, ownerId)))
      .returning({ id: assets.id });
    if (deleted.length === 0) {
      return { error: "Anlage nicht gefunden oder keine Berechtigung." };
    }
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Löschen fehlgeschlagen: ${err.message}`
          : "Löschen fehlgeschlagen.",
    };
  }

  revalidatePath("/assets");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
  return { success: true };
}
