"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  invoices,
  invoiceItems,
  companyProfile,
  transactions,
  categories,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { parseEuroToCents } from "@/lib/money";
import { isYearLocked, yearOf } from "@/lib/fiscal";
import { computeInvoiceTotal, formatInvoiceNumber } from "@/lib/calc/invoice";
import { invoiceSchema } from "@/lib/validation/invoice";

export type ActionState = { error?: string; success?: boolean };

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  return user.id;
}

export async function createInvoice(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  // Positionen aus den parallelen Formularfeldern zusammensetzen.
  const descriptions = formData.getAll("description").map(String);
  const quantities = formData.getAll("quantity").map(String);
  const unitPrices = formData.getAll("unitPrice").map(String);

  const lines: {
    description: string;
    quantity: number;
    unitPriceCents: number;
  }[] = [];
  for (let i = 0; i < descriptions.length; i++) {
    const desc = descriptions[i]?.trim() ?? "";
    const qtyRaw = quantities[i] ?? "";
    const priceRaw = unitPrices[i] ?? "";
    // Komplett leere Zeilen überspringen.
    if (!desc && !priceRaw && (!qtyRaw || qtyRaw === "1")) continue;
    let unitPriceCents = 0;
    try {
      unitPriceCents = priceRaw ? parseEuroToCents(priceRaw) : 0;
    } catch {
      return { error: `Preis in Position ${i + 1} ist ungültig.` };
    }
    lines.push({
      description: desc,
      quantity: parseInt(qtyRaw || "1", 10) || 1,
      unitPriceCents,
    });
  }

  const parsed = invoiceSchema.safeParse({
    customerId: String(formData.get("customerId") ?? ""),
    date: String(formData.get("date") ?? ""),
    lines,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Eingabe ungültig." };
  }
  const data = parsed.data;
  const total = computeInvoiceTotal(
    data.lines.map((l) => ({ quantity: l.quantity, unitPrice: l.unitPriceCents })),
  );
  const year = Number(data.date.slice(0, 4));

  await db.transaction(async (tx) => {
    const profile = await tx.select().from(companyProfile).limit(1);
    const seq = profile[0]?.nextInvoiceNo ?? 1;
    const number = formatInvoiceNumber(seq, year);

    const inserted = await tx
      .insert(invoices)
      .values({
        ownerId,
        number,
        date: data.date,
        customerId: data.customerId,
        status: "draft",
        total,
      })
      .returning({ id: invoices.id });

    const invoiceId = inserted[0].id;
    await tx.insert(invoiceItems).values(
      data.lines.map((l) => ({
        invoiceId,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPriceCents,
      })),
    );

    if (profile[0]) {
      await tx
        .update(companyProfile)
        .set({ nextInvoiceNo: seq + 1 })
        .where(eq(companyProfile.id, profile[0].id));
    }
  });

  revalidatePath("/invoices");
  redirect("/invoices");
}

export async function deleteInvoice(id: string): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  // Eventuelle verknüpfte Einnahme lösen (Buchung bleibt erhalten).
  await db
    .update(transactions)
    .set({ invoiceId: null })
    .where(and(eq(transactions.invoiceId, id), eq(transactions.ownerId, ownerId)));

  // Items werden per FK-Cascade mitgelöscht.
  await db
    .delete(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.ownerId, ownerId)));

  revalidatePath("/invoices");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Status setzen. Beim Wechsel auf "bezahlt" wird automatisch eine Einnahme
 * in der EÜR angelegt (idempotent — nur wenn noch keine existiert).
 */
export async function setInvoiceStatus(
  id: string,
  status: "draft" | "sent" | "paid",
): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  const found = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.ownerId, ownerId)))
    .limit(1);
  const invoice = found[0];
  if (!invoice) return { error: "Rechnung nicht gefunden." };

  if (status === "paid") {
    if (await isYearLocked(ownerId, yearOf(invoice.date))) {
      return {
        error: `Jahr ${yearOf(invoice.date)} ist festgeschrieben — Zahlung kann nicht gebucht werden.`,
      };
    }
    const existing = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.invoiceId, id),
          eq(transactions.ownerId, ownerId),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      // Passende Einnahmekategorie suchen (optional).
      const cat = await db
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.direction, "income"),
            eq(categories.name, "Verkauf Auftragsfertigung"),
          ),
        )
        .limit(1);

      await db.insert(transactions).values({
        ownerId,
        direction: "income",
        amount: invoice.total,
        date: invoice.date,
        description: `Rechnung ${invoice.number}`,
        categoryId: cat[0]?.id ?? null,
        invoiceId: id,
        paymentMethod: "Überweisung",
      });
    }
  }

  await db
    .update(invoices)
    .set({ status })
    .where(and(eq(invoices.id, id), eq(invoices.ownerId, ownerId)));

  revalidatePath("/invoices");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}
