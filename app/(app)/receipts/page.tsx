/**
 * Belege — Upload (Handy-Kamera) und Galerie.
 * Dateien liegen privat in Supabase Storage; Anzeige über signierte URLs.
 */
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { receipts } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import ReceiptUpload from "@/components/ReceiptUpload";
import ReceiptDeleteButton from "@/components/ReceiptDeleteButton";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage() {
  const supabase = await createClient();

  const rows = await db
    .select()
    .from(receipts)
    .orderBy(desc(receipts.uploadedAt))
    .limit(100);

  const items = await Promise.all(
    rows.map(async (r) => {
      const { data } = await supabase.storage
        .from("belege")
        .createSignedUrl(r.filePath, 3600);
      return {
        ...r,
        url: data?.signedUrl ?? null,
        isPdf: r.filePath.toLowerCase().endsWith(".pdf"),
      };
    }),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold">Belege</h1>
      <p className="mb-6 text-sm text-muted">
        Quittungen und Eingangsrechnungen ablegen — GoBD-konform mit Prüfsumme.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <div>
          <ReceiptUpload />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">
            Abgelegte Belege ({items.length})
          </h2>
          {items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              Noch keine Belege. Lade links deinen ersten hoch.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {items.map((r) => (
                <div
                  key={r.id}
                  className="group relative overflow-hidden rounded-lg border border-border transition hover:border-brand"
                >
                  <ReceiptDeleteButton id={r.id} />
                  <a
                    href={r.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                  <div className="flex h-32 items-center justify-center bg-black/5">
                    {r.isPdf || !r.url ? (
                      <span className="text-4xl">📄</span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.url}
                        alt={r.note ?? "Beleg"}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                    <div className="p-2">
                      <p className="truncate text-xs font-medium">
                        {r.note ?? "Beleg"}
                      </p>
                      <p className="text-[10px] text-muted">
                        {r.uploadedAt
                          ? new Date(r.uploadedAt).toLocaleDateString("de-DE")
                          : ""}
                      </p>
                    </div>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
