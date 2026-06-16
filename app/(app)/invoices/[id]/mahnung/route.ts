/**
 * Liefert das Mahnungs-PDF einer Rechnung.
 * Stufe per ?level=1|2 (Default: aktuelle dunningLevel der Rechnung).
 * Bevorzugt das archivierte PDF aus Storage, sonst on-the-fly generiert.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices, customers, companyProfile } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { generateDunningPdf } from "@/lib/pdf/dunning-pdf";
import { addDaysIso } from "@/lib/calc/invoice";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const levelParam = Number(url.searchParams.get("level"));

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

  const level: 1 | 2 =
    levelParam === 1 || levelParam === 2
      ? (levelParam as 1 | 2)
      : (invoice.dunningLevel ?? 0) >= 2
        ? 2
        : 1;

  // Archiviertes PDF aus Storage liefern, falls vorhanden.
  const storagePath = `mahnungen/MAHNUNG-${level}-${invoice.number}.pdf`;
  const { data: signed } = await supabase.storage
    .from("belege")
    .createSignedUrl(storagePath, 300);
  if (signed?.signedUrl) {
    return Response.redirect(signed.signedUrl);
  }

  // Fallback: on-the-fly generieren.
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
    const res = await fetch(new URL("/logo.png", request.url));
    if (res.ok) logo = new Uint8Array(await res.arrayBuffer());
  } catch {
    /* Logo optional */
  }

  const today = new Date().toISOString().slice(0, 10);
  const dueIso = invoice.dueDate ?? invoice.date;
  const dayMs = 1000 * 60 * 60 * 24;
  const daysOverdue = Math.max(
    0,
    Math.floor(
      (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueIso}T00:00:00Z`)) /
        dayMs,
    ),
  );

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
    payUntil: addDaysIso(today, 7),
    today,
    logo,
  });

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="MAHNUNG-${level}-${invoice.number}.pdf"`,
    },
  });
}
