"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { categorySchema } from "@/lib/validation/category";

export type ActionState = { error?: string; success?: boolean };

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  return user.id;
}

/**
 * Der Inhaber darf seine eigenen Kategorien UND die geteilten Standard-
 * Kategorien aus dem Seed (ownerId = NULL) bearbeiten/löschen.
 */
function ownedBy(uid: string): SQL | undefined {
  return or(eq(categories.ownerId, uid), isNull(categories.ownerId));
}

function parseForm(
  formData: FormData,
):
  | {
      data: {
        name: string;
        direction: "income" | "expense";
        elsterKennzahl: string | null;
      };
    }
  | { error: string } {
  const rawKennzahl = String(formData.get("elsterKennzahl") ?? "").trim();
  const parsed = categorySchema.safeParse({
    name: String(formData.get("name") ?? ""),
    direction: formData.get("direction"),
    elsterKennzahl: rawKennzahl === "" ? null : rawKennzahl,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Eingabe ungültig." };
  }
  return {
    data: {
      name: parsed.data.name,
      direction: parsed.data.direction,
      elsterKennzahl: parsed.data.elsterKennzahl ?? null,
    },
  };
}

export async function createCategory(
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

  await db.insert(categories).values({
    ownerId,
    name: result.data.name,
    direction: result.data.direction,
    elsterKennzahl: result.data.elsterKennzahl,
  });

  revalidatePath("/categories");
  revalidatePath("/transactions");
  return { success: true };
}

export async function updateCategory(
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
  if (!id) return { error: "Keine Kategorie ausgewählt." };

  const result = parseForm(formData);
  if ("error" in result) return result;

  await db
    .update(categories)
    .set({
      name: result.data.name,
      direction: result.data.direction,
      elsterKennzahl: result.data.elsterKennzahl,
    })
    .where(and(eq(categories.id, id), ownedBy(ownerId)));

  revalidatePath("/categories");
  revalidatePath("/transactions");
  redirect("/categories");
}

export async function deleteCategory(id: string): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  try {
    await db
      .delete(categories)
      .where(and(eq(categories.id, id), ownedBy(ownerId)));
  } catch {
    return {
      error:
        "Kategorie wird noch von Buchungen verwendet und kann nicht gelöscht werden.",
    };
  }

  revalidatePath("/categories");
  revalidatePath("/transactions");
  return { success: true };
}
