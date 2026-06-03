"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import {
  extractShopifyMarker,
  isImportableShopifyStatus,
  parseShopifyImportText,
  shopifyMarker,
  type ShopifyImportOrder,
} from "@/lib/import/shopify";

export type ShopifyPreviewOrder = ShopifyImportOrder & {
  duplicate: boolean;
  importable: boolean;
  skipReason: string | null;
};

export type PreviewState = {
  error?: string;
  success?: boolean;
  orders?: ShopifyPreviewOrder[];
  parseErrors?: string[];
  summary?: {
    parsed: number;
    ready: number;
    duplicates: number;
    skipped: number;
  };
};

export type ImportState = {
  error?: string;
  success?: boolean;
  imported?: number;
  skipped?: number;
};

const importOrderSchema = z.object({
  externalId: z.string().trim().min(1).max(300),
  orderName: z.string().trim().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCents: z.number().int().positive(),
  financialStatus: z.string().trim().max(100).nullable(),
  customerName: z.string().trim().max(200).nullable(),
  email: z.string().trim().max(200).nullable(),
});

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  return user.id;
}

export async function previewShopifyImport(
  _prev: PreviewState,
  formData: FormData,
): Promise<PreviewState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  const file = formData.get("file");
  const pasted = String(formData.get("payload") ?? "").trim();
  let text = pasted;
  let filename = "shopify-import.txt";

  if (file instanceof File && file.size > 0) {
    if (file.size > 2_000_000) {
      return { error: "Importdatei ist zu groß (max. 2 MB)." };
    }
    text = await file.text();
    filename = file.name;
  }

  if (!text.trim()) {
    return { error: "Bitte CSV/JSON-Datei auswählen oder Inhalt einfügen." };
  }

  const parsed = parseShopifyImportText(text, filename);
  if (parsed.orders.length === 0) {
    return {
      error: parsed.errors[0] ?? "Keine importierbaren Bestellungen gefunden.",
      parseErrors: parsed.errors,
    };
  }

  const existing = await existingShopifyIds(ownerId);
  const orders = parsed.orders.map((order): ShopifyPreviewOrder => {
    const duplicate = existing.has(order.externalId);
    const statusOk = isImportableShopifyStatus(order.financialStatus);
    const skipReason = duplicate
      ? "Bereits importiert"
      : statusOk
        ? null
        : `Status: ${order.financialStatus ?? "unbekannt"}`;
    return {
      ...order,
      duplicate,
      importable: !duplicate && statusOk,
      skipReason,
    };
  });

  return {
    success: true,
    orders,
    parseErrors: parsed.errors,
    summary: {
      parsed: orders.length,
      ready: orders.filter((order) => order.importable).length,
      duplicates: orders.filter((order) => order.duplicate).length,
      skipped: orders.filter((order) => !order.importable).length,
    },
  };
}

export async function importShopifyOrders(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  let ownerId: string;
  try {
    ownerId = await requireUserId();
  } catch {
    return { error: "Sitzung abgelaufen. Bitte neu anmelden." };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("orders") ?? "[]"));
  } catch {
    return { error: "Importdaten konnten nicht gelesen werden." };
  }

  const parsed = z.array(importOrderSchema).max(1000).safeParse(payload);
  if (!parsed.success) {
    return { error: "Importdaten sind ungültig." };
  }

  const existing = await existingShopifyIds(ownerId);
  const categoryId = await shopifyCategoryId(ownerId);
  const ready = parsed.data.filter((order) => {
    return (
      !existing.has(order.externalId) &&
      isImportableShopifyStatus(order.financialStatus)
    );
  });

  if (ready.length > 0) {
    await db.insert(transactions).values(
      ready.map((order) => ({
        ownerId,
        date: order.date,
        direction: "income" as const,
        amount: order.amountCents,
        description: descriptionForOrder(order),
        paymentMethod: "Shopify",
        categoryId,
      })),
    );
  }

  revalidatePath("/shopify");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/reports");

  return {
    success: true,
    imported: ready.length,
    skipped: parsed.data.length - ready.length,
  };
}

async function existingShopifyIds(ownerId: string): Promise<Set<string>> {
  const rows = await db
    .select({ description: transactions.description })
    .from(transactions)
    .where(eq(transactions.ownerId, ownerId));

  return new Set(
    rows
      .map((row) => extractShopifyMarker(row.description))
      .filter((id): id is string => !!id),
  );
}

async function shopifyCategoryId(ownerId: string): Promise<string | null> {
  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.direction, "income"),
        eq(categories.name, "Verkauf Teile (Shopify)"),
        or(eq(categories.ownerId, ownerId), isNull(categories.ownerId)),
      ),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

function descriptionForOrder(order: ShopifyImportOrder): string {
  const customer = order.customerName ? ` · ${order.customerName}` : "";
  return `Shopify ${order.orderName}${customer} ${shopifyMarker(order.externalId)}`;
}
