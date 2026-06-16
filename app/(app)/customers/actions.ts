"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { customerSchema } from "@/lib/validation/customer";

export type ActionState = { error?: string; success?: boolean };

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  return user.id;
}

function parseForm(
  formData: FormData,
): { data: { name: string; address: string; email: string } } | { error: string } {
  const parsed = customerSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    address: String(formData.get("address") ?? ""),
    email: String(formData.get("email") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Eingabe ungültig." };
  }
  return {
    data: {
      name: parsed.data.name,
      address: parsed.data.address ?? "",
      email: parsed.data.email ?? "",
    },
  };
}

export async function createCustomer(
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

  await db.insert(customers).values({
    ownerId,
    name: result.data.name,
    address: result.data.address || null,
    email: result.data.email || null,
  });

  revalidatePath("/customers");
  return { success: true };
}

export async function updateCustomer(
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
  if (!id) return { error: "Kein Kunde ausgewählt." };

  const result = parseForm(formData);
  if ("error" in result) return result;

  await db
    .update(customers)
    .set({
      name: result.data.name,
      address: result.data.address || null,
      email: result.data.email || null,
    })
    .where(and(eq(customers.id, id), eq(customers.ownerId, ownerId)));

  revalidatePath("/customers");
  redirect("/customers");
}

export async function deleteCustomer(id: string): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  try {
    const deleted = await db
      .delete(customers)
      .where(and(eq(customers.id, id), eq(customers.ownerId, ownerId)))
      .returning({ id: customers.id });
    if (deleted.length === 0) {
      return { error: "Kunde nicht gefunden oder keine Berechtigung." };
    }
  } catch {
    return {
      error: "Kunde kann nicht gelöscht werden (hat verknüpfte Rechnungen).",
    };
  }

  revalidatePath("/customers");
  return { success: true };
}
