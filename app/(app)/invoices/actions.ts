"use server";

import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  invoices,
  invoiceItems,
  customers,
  companyProfile,
  transactions,
  categories,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { parseEuroToCents } from "@/lib/money";
import { isYearLocked, yearOf } from "@/lib/fiscal";
import {
  computeInvoiceTotal,
  formatInvoiceNumber,
  addDaysIso,
} from "@/lib/calc/invoice";
import { invoiceSchema } from "@/lib/validation/invoice";
import { generateInvoicePdf } from "@/lib/pdf/invoice-pdf";
import { generateDunningPdf } from "@/lib/pdf/dunning-pdf";

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

  // Zahlungsziel: Fälligkeit = Rechnungsdatum + N Tage.
  const termsRaw = parseInt(String(formData.get("paymentTermsDays") ?? ""), 10);
  const termsDays = Number.isNaN(termsRaw) || termsRaw < 0 ? 14 : termsRaw;
  const dueDate = addDaysIso(data.date, termsDays);

  let createdId = "";
  let createdNumber = "";

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
        dueDate,
        customerId: data.customerId,
        status: "draft",
        total,
      })
      .returning({ id: invoices.id });

    createdId = inserted[0].id;
    createdNumber = number;

    await tx.insert(invoiceItems).values(
      data.lines.map((l) => ({
        invoiceId: createdId,
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

  // PDF generieren und in Storage archivieren (GoBD: unveränderbare Ablage).
  // Fehler hier blockieren nicht die Rechnungserstellung.
  try {
    const [itemsForPdf, customerRows, profileRows] = await Promise.all([
      db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, createdId)),
      data.customerId
        ? db
            .select()
            .from(customers)
            .where(eq(customers.id, data.customerId))
            .limit(1)
        : Promise.resolve([]),
      db.select().from(companyProfile).limit(1),
    ]);

    const customer = customerRows[0];
    const profile = profileRows[0];

    let logo: Uint8Array | null = null;
    try {
      const buf = await fs.readFile(
        path.join(process.cwd(), "public", "logo.png"),
      );
      logo = new Uint8Array(buf);
    } catch {
      /* Logo optional */
    }

    const pdfBytes = await generateInvoicePdf({
      profile: {
        name: profile?.name ?? "EDGECO",
        address: profile?.address ?? null,
        steuernummer: profile?.steuernummer ?? null,
        iban: profile?.iban ?? null,
        kleinunternehmerHinweis: profile?.kleinunternehmerHinweis ?? null,
      },
      customer: {
        name: customer?.name ?? "—",
        address: customer?.address ?? null,
      },
      invoice: {
        number: createdNumber,
        date: data.date,
        total,
        dueDate,
      },
      items: itemsForPdf.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
      logo,
    });

    const storagePath = `rechnungen/${createdNumber}.pdf`;
    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from("belege")
      .upload(storagePath, Buffer.from(pdfBytes), {
        contentType: "application/pdf",
        upsert: false,
      });

    if (!uploadError) {
      await db
        .update(invoices)
        .set({ pdfPath: storagePath })
        .where(eq(invoices.id, createdId));
    }
  } catch {
    // PDF-Archivierung fehlgeschlagen — Rechnung ist trotzdem gespeichert.
  }

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

  // Rechnung laden um ggf. archiviertes PDF zu entfernen.
  const found = await db
    .select({ pdfPath: invoices.pdfPath })
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.ownerId, ownerId)))
    .limit(1);

  if (found[0]?.pdfPath) {
    try {
      const supabase = await createClient();
      await supabase.storage.from("belege").remove([found[0].pdfPath]);
    } catch {
      /* Storage-Fehler nicht blockieren */
    }
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

/**
 * Mahnung versenden: setzt dunning_level und dunning_date, generiert ein
 * Mahnungs-PDF und archiviert es im Storage unter mahnungen/.
 */
export async function sendDunning(
  invoiceId: string,
  level: 1 | 2,
): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  if (level !== 1 && level !== 2) {
    return { error: "Ungültige Mahnstufe." };
  }

  const found = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.ownerId, ownerId)))
    .limit(1);
  const invoice = found[0];
  if (!invoice) return { error: "Rechnung nicht gefunden." };

  if (invoice.status === "paid" || invoice.status === "cancelled") {
    return { error: "Mahnung nur für offene Rechnungen möglich." };
  }
  if ((invoice.dunningLevel ?? 0) >= level) {
    return { error: "Diese Mahnstufe wurde bereits versendet." };
  }

  const today = new Date().toISOString().slice(0, 10);

  // Mahn-PDF generieren und archivieren (Fehler blockieren nicht den Status).
  try {
    const [customerRows, profileRows] = await Promise.all([
      invoice.customerId
        ? db
            .select()
            .from(customers)
            .where(eq(customers.id, invoice.customerId))
            .limit(1)
        : Promise.resolve([]),
      db.select().from(companyProfile).limit(1),
    ]);
    const customer = customerRows[0];
    const profile = profileRows[0];

    let logo: Uint8Array | null = null;
    try {
      const buf = await fs.readFile(
        path.join(process.cwd(), "public", "logo.png"),
      );
      logo = new Uint8Array(buf);
    } catch {
      /* Logo optional */
    }

    const dueIso = invoice.dueDate ?? invoice.date;
    const dayMs = 1000 * 60 * 60 * 24;
    const daysOverdue = Math.max(
      0,
      Math.floor(
        (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueIso}T00:00:00Z`)) /
          dayMs,
      ),
    );
    const payUntil = addDaysIso(today, 7);

    const pdfBytes = await generateDunningPdf({
      level,
      profile: {
        name: profile?.name ?? "EDGECO",
        address: profile?.address ?? null,
        steuernummer: profile?.steuernummer ?? null,
        iban: profile?.iban ?? null,
      },
      customer: {
        name: customer?.name ?? "—",
        address: customer?.address ?? null,
      },
      invoice: {
        number: invoice.number,
        date: invoice.date,
        total: invoice.total,
        dueDate: invoice.dueDate ?? null,
      },
      daysOverdue,
      payUntil,
      today,
      logo,
    });

    const storagePath = `mahnungen/MAHNUNG-${level}-${invoice.number}.pdf`;
    const supabase = await createClient();
    await supabase.storage
      .from("belege")
      .upload(storagePath, Buffer.from(pdfBytes), {
        contentType: "application/pdf",
        upsert: true,
      });
  } catch {
    // PDF-Archivierung fehlgeschlagen — Mahnstufe wird trotzdem gesetzt.
  }

  await db
    .update(invoices)
    .set({ dunningLevel: level, dunningDate: today })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.ownerId, ownerId)));

  revalidatePath("/invoices");
  revalidatePath("/offene-posten");
  return { success: true };
}
