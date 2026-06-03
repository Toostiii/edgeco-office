"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteReceipt } from "@/app/(app)/receipts/actions";

export default function ReceiptDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Diesen Beleg endgültig löschen?")) {
      startTransition(async () => {
        await deleteReceipt(id);
        router.refresh();
      });
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      title="Beleg löschen"
      className="absolute right-1 top-1 z-10 rounded-full bg-white/90 px-2 py-0.5 text-xs text-expense shadow transition hover:bg-white disabled:opacity-50"
    >
      {pending ? "…" : "✕"}
    </button>
  );
}
