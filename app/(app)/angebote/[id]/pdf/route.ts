/**
 * Liefert das Angebots-PDF. Bevorzugt das archivierte PDF aus Storage,
 * sonst on-the-fly generiert.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { quotes, quoteItems, customers, companyProfile } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { generateQuotePdf } from "@/lib/pdf/quote-pdf";

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

  const quoteRows = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, id), eq(quotes.ownerId, user.id)))
    .limit(1);
  const quote = quoteRows[0];
  if (!quote) return new Response("Angebot nicht gefunden.", { status: 404 });

  if (quote.pdfPath) {
    const { data: signed } = await supabase.storage
      .from("belege")
      .createSignedUrl(quote.pdfPath, 300);
    if (signed?.signedUrl) {
      return Response.redirect(signed.signedUrl);
    }
  }

  const [items, customerRows, profileRows] = await Promise.all([
    db.select().from(quoteItems).where(eq(quoteItems.quoteId, id)),
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

  let logo: Uint8Array | null = null;
  try {
    const res = await fetch(new URL("/logo.png", request.url));
    if (res.ok) logo = new Uint8Array(await res.arrayBuffer());
  } catch {
    /* Logo optional */
  }

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
      number: quote.number,
      date: quote.date,
      total: quote.total,
      validUntil: quote.validUntil ?? null,
      notes: quote.notes ?? null,
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
      "Content-Disposition": `inline; filename="${quote.number}.pdf"`,
    },
  });
}
