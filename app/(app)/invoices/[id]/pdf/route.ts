/**
 * Liefert das Rechnungs-PDF. Eigene Auth-Prüfung, da Route-Handler nicht vom
 * (app)-Layout geschützt werden.
 * Archiviertes PDF (pdfPath) wird bevorzugt aus Storage geladen; sonst
 * on-the-fly generiert (Fallback für ältere Rechnungen).
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  invoices,
  invoiceItems,
  customers,
  companyProfile,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { generateInvoicePdf } from "@/lib/pdf/invoice-pdf";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Nicht angemeldet.", { status: 401 });

  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.ownerId, user.id)))
    .limit(1);
  const invoice = invoiceRows[0];
  if (!invoice) return new Response("Rechnung nicht gefunden.", { status: 404 });

  // Archiviertes PDF aus Storage liefern (GoBD-konform, unveränderbar).
  if (invoice.pdfPath) {
    const { data: signed } = await supabase.storage
      .from("belege")
      .createSignedUrl(invoice.pdfPath, 300);

    if (signed?.signedUrl) {
      return Response.redirect(signed.signedUrl);
    }
  }

  // Fallback: on-the-fly generieren (für Rechnungen ohne archiviertes PDF).
  const [items, customerRows, profileRows] = await Promise.all([
    db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)),
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

  // Logo vom öffentlichen Asset laden (serverless-tauglich).
  let logo: Uint8Array | null = null;
  try {
    const res = await fetch(new URL("/logo.png", request.url));
    if (res.ok) logo = new Uint8Array(await res.arrayBuffer());
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
      number: invoice.number,
      date: invoice.date,
      total: invoice.total,
    },
    items: items.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
    })),
    logo,
  });

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
    },
  });
}
