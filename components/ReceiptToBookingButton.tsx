"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseReceiptText } from "@/lib/ocr/parse-receipt";

function centsToInput(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function ReceiptToBookingButton({
  receiptId,
  imageUrl,
}: {
  receiptId: string;
  imageUrl: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    setBusy(true);
    setProgress(0);
    try {
      const Tesseract = (await import("tesseract.js")).default;
      const { data } = await Tesseract.recognize(imageUrl, "deu", {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const parsed = parseReceiptText(data.text ?? "");
      const params = new URLSearchParams({ receiptId });
      if (parsed.amountCents) params.set("amount", centsToInput(parsed.amountCents));
      if (parsed.date) params.set("date", parsed.date);

      router.push(`/transactions?${params.toString()}`);
    } catch {
      setError("Beleg konnte nicht gelesen werden.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={run}
        disabled={busy}
        className="w-full rounded-md border border-brand/40 px-2 py-1 text-xs font-medium text-brand transition hover:bg-brand/5 disabled:opacity-50"
      >
        {busy ? `Lese Beleg … ${progress}%` : "→ Buchung aus Beleg"}
      </button>
      {error && <p className="mt-1 text-[10px] text-expense">{error}</p>}
    </div>
  );
}
