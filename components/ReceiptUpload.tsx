"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createReceipt } from "@/app/(app)/receipts/actions";

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function ReceiptUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setOk(false);
    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Sitzung abgelaufen. Bitte neu anmelden.");
        return;
      }

      const hash = await sha256Hex(file);
      const ext = file.name.includes(".")
        ? file.name.split(".").pop()
        : file.type === "application/pdf"
          ? "pdf"
          : "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("belege")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        setError(`Upload fehlgeschlagen: ${upErr.message}`);
        return;
      }

      const res = await createReceipt({ filePath: path, fileHash: hash, note });
      if (res.error) {
        setError(res.error);
        return;
      }

      setOk(true);
      setNote("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold">Beleg hinzufügen</h2>

      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-medium">
          Notiz (optional)
        </span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="z. B. Tankquittung, Materialeinkauf"
          className="w-full rounded-lg border border-border px-3 py-2 outline-none focus:border-brand"
        />
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
        className="hidden"
        id="receipt-file"
      />
      <label
        htmlFor="receipt-file"
        className={`brand-gradient flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg py-3 font-semibold text-white transition hover:opacity-90 ${
          busy ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {busy ? "Lädt hoch …" : "📷 Beleg fotografieren / hochladen"}
      </label>

      <p className="mt-2 text-xs text-muted">
        Auf dem Handy öffnet sich die Kamera. Bild oder PDF möglich.
      </p>

      {error && <p className="mt-3 text-sm text-expense">{error}</p>}
      {ok && <p className="mt-3 text-sm text-income">Beleg gespeichert ✓</p>}
    </div>
  );
}
