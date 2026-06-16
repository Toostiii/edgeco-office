"use server";

import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  quotes,
  quoteItems,
  invoices,
  invoiceItems,
  customers,
  companyProfile,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { parseEuroToCents } from "@/lib/money";
import {
  computeInvoiceTotal,
  formatQuoteNumber,
  formatInvoiceNumber,
  addDaysIso,
} from "@/lib/calc/invoice";
import { quoteSchema } from "@/lib/validation/quote";
import { generateQuotePdf } from "@/lib/pdf/quote-pdf";
import { generateInvoicePdf } from "@/lib/pdf/invoice-pdf";

export type ActionState = { error?: string; success?: boolean };

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  return user.id;
}

async function loadLogo(): Promise<Uint8Array | null> {
  try {
    const buf = await fs.readFile(path.join(process.cwd(), "public", "logo.png"));
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

export async function createQuote(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

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

  const validUntilRaw = String(formData.get("validUntil") ?? "").trim();
  const parsed = quoteSchema.safeParse({
    customerId: String(formData.get("customerId") ?? ""),
    date: String(formData.get("date") ?? ""),
    validUntil: validUntilRaw === "" ? null : validUntilRaw,
    notes: String(formData.get("notes") ?? ""),
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

  let createdId = "";
  let createdNumber = "";

  await db.transaction(async (tx) => {
    const profile = await tx.select().from(companyProfile).limit(1);
    const seq = profile[0]?.nextQuoteNo ?? 1;
    const number = formatQuoteNumber(seq, year);

    const inserted = await tx
      .insert(quotes)
      .values({
        ownerId,
        number,
        date: data.date,
        validUntil: data.validUntil ?? null,
        customerId: data.customerId,
        status: "draft",
        total,
        notes: data.notes || null,
      })
      .returning({ id: quotes.id });

    createdId = inserted[0].id;
    createdNumber = number;

    await tx.insert(quoteItems).values(
      data.lines.map((l) => ({
        quoteId: createdId,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPriceCents,
      })),
    );

    if (profile[0]) {
      await tx
        .update(companyProfile)
        .set({ nextQuoteNo: seq + 1 })
        .where(eq(companyProfile.id, profile[0].id));
    }
  });

  // PDF generieren und archivieren (Fehler blockieren nicht).
  try {
    const [itemsForPdf, customerRows, profileRows] = await Promise.all([
      db.select().from(quoteItems).where(eq(quoteItems.quoteId, createdId)),
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
    const logo = await loadLogo();

    const pdfBytes = await generateQuotePdf({
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
      quote: {
        number: createdNumber,
        date: data.date,
        total,
        validUntil: data.validUntil ?? null,
        notes: data.notes || null,
      },
      items: itemsForPdf.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
      logo,
    });

    const storagePath = `angebote/${createdNumber}.pdf`;
    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from("belege")
      .upload(storagePath, Buffer.from(pdfBytes), {
        contentType: "application/pdf",
        upsert: true,
      });
    if (!uploadError) {
      await db
        .update(quotes)
        .set({ pdfPath: storagePath })
        .where(eq(quotes.id, createdId));
    }
  } catch {
    // Archivierung fehlgeschlagen — Angebot ist trotzdem gespeichert.
  }

  revalidatePath("/angebote");
  redirect("/angebote");
}

export async function deleteQuote(id: string): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  const found = await db
    .select({ pdfPath: quotes.pdfPath })
    .from(quotes)
    .where(and(eq(quotes.id, id), eq(quotes.ownerId, ownerId)))
    .limit(1);

  if (found[0]?.pdfPath) {
    try {
      const supabase = await createClient();
      await supabase.storage.from("belege").remove([found[0].pdfPath]);
    } catch {
      /* Storage-Fehler nicht blockieren */
    }
  }

  // Items per FK-Cascade.
  await db
    .delete(quotes)
    .where(and(eq(quotes.id, id), eq(quotes.ownerId, ownerId)));

  revalidatePath("/angebote");
  return { success: true };
}

export async function setQuoteStatus(
  id: string,
  status: "draft" | "sent" | "accepted" | "rejected",
): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  await db
    .update(quotes)
    .set({ status })
    .where(and(eq(quotes.id, id), eq(quotes.ownerId, ownerId)));

  revalidatePath("/angebote");
  return { success: true };
}

/**
 * Angebot in Rechnung umwandeln: erstellt eine neue Rechnung mit denselben
 * Positionen, setzt quote.status = 'converted' und verknüpft die Rechnung.
 */
export async function convertToInvoice(id: string): Promise<ActionState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  const found = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, id), eq(quotes.ownerId, ownerId)))
    .limit(1);
  const quote = found[0];
  if (!quote) return { error: "Angebot nicht gefunden." };
  if (quote.status === "converted" || quote.invoiceId) {
    return { error: "Angebot wurde bereits umgewandelt." };
  }

  const items = await db
    .select()
    .from(quoteItems)
    .where(eq(quoteItems.quoteId, id));
  if (items.length === 0) {
    return { error: "Angebot hat keine Positionen." };
  }

  const today = new Date().toISOString().slice(0, 10);
  const year = Number(today.slice(0, 4));

  let invoiceId = "";
  let invoiceNumber = "";
  let dueDate = today;

  await db.transaction(async (tx) => {
    const profile = await tx.select().from(companyProfile).limit(1);
    const seq = profile[0]?.nextInvoiceNo ?? 1;
    invoiceNumber = formatInvoiceNumber(seq, year);
    const termsDays = profile[0]?.paymentTermsDays ?? 14;
    dueDate = addDaysIso(today, termsDays);

    const inserted = await tx
      .insert(invoices)
      .values({
        ownerId,
        number: invoiceNumber,
        date: today,
        dueDate,
        customerId: quote.customerId,
        status: "draft",
        total: quote.total,
      })
      .returning({ id: invoices.id });
    invoiceId = inserted[0].id;

    await tx.insert(invoiceItems).values(
      items.map((it) => ({
        invoiceId,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
    );

    if (profile[0]) {
      await tx
        .update(companyProfile)
        .set({ nextInvoiceNo: seq + 1 })
        .where(eq(companyProfile.id, profile[0].id));
    }

    await tx
      .update(quotes)
      .set({ status: "converted", invoiceId })
      .where(eq(quotes.id, id));
  });

  // Rechnungs-PDF generieren und archivieren.
  try {
    const [customerRows, profileRows] = await Promise.all([
      quote.customerId
        ? db
            .select()
            .from(customers)
            .where(eq(customers.id, quote.customerId))
            .limit(1)
        : Promise.resolve([]),
      db.select().from(companyProfile).limit(1),
    ]);
    const customer = customerRows[0];
    const profile = profileRows[0];
    const logo = await loadLogo();

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
        number: invoiceNumber,
        date: today,
        total: quote.total,
        dueDate,
      },
      items: items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
      logo,
    });

    const storagePath = `rechnungen/${invoiceNumber}.pdf`;
    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from("belege")
      .upload(storagePath, Buffer.from(pdfBytes), {
        contentType: "application/pdf",
        upsert: true,
      });
    if (!uploadError) {
      await db
        .update(invoices)
        .set({ pdfPath: storagePath })
        .where(eq(invoices.id, invoiceId));
    }
  } catch {
    // Rechnung ist trotzdem gespeichert.
  }

  revalidatePath("/angebote");
  revalidatePath("/invoices");
  return { success: true };
}
