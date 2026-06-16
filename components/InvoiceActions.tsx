"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setInvoiceStatus,
  deleteInvoice,
  sendDunning,
} from "@/app/(app)/invoices/actions";

export default function InvoiceActions({
  id,
  status,
  dueDate = null,
  dunningLevel = 0,
}: {
  id: string;
  status: "draft" | "sent" | "paid" | "cancelled";
  dueDate?: string | null;
  dunningLevel?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const overdue =
    (status === "sent" || status === "draft") && !!dueDate && dueDate < today;
  const nextLevel = (dunningLevel >= 1 ? 2 : 1) as 1 | 2;
  const canDun = overdue && dunningLevel < 2;

  function changeStatus(s: "draft" | "sent" | "paid") {
    startTransition(async () => {
      await setInvoiceStatus(id, s);
      router.refresh();
    });
  }

  function dun(level: 1 | 2) {
    startTransition(async () => {
      const res = await sendDunning(id, level);
      if (res.error) alert(res.error);
      router.refresh();
    });
  }

  function remove() {
    if (confirm("Diese Rechnung löschen?")) {
      startTransition(async () => {
        const res = await deleteInvoice(id);
        if (res.error) alert(res.error);
        router.refresh();
      });
    }
  }

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <a
        href={`/invoices/${id}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium text-brand underline-offset-2 hover:underline"
      >
        PDF
      </a>
      {status === "draft" && (
        <button
          onClick={() => changeStatus("sent")}
          disabled={pending}
          className="text-xs text-muted hover:text-foreground disabled:opacity-50"
        >
          → versendet
        </button>
      )}
      {(status === "draft" || status === "sent") && (
        <button
          onClick={() => changeStatus("paid")}
          disabled={pending}
          className="text-xs text-income hover:underline disabled:opacity-50"
        >
          → bezahlt
        </button>
      )}
      {canDun && (
        <button
          onClick={() => dun(nextLevel)}
          disabled={pending}
          className="text-xs text-expense hover:underline disabled:opacity-50"
          title="Mahnung erstellen und archivieren"
        >
          {nextLevel}. Mahnung
        </button>
      )}
      {dunningLevel > 0 && (
        <a
          href={`/invoices/${id}/mahnung?level=${dunningLevel}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted underline-offset-2 hover:underline"
          title="Letzte Mahnung als PDF"
        >
          Mahnung-PDF
        </a>
      )}
      <button
        onClick={remove}
        disabled={pending}
        className="text-xs text-muted hover:text-expense disabled:opacity-50"
      >
        Löschen
      </button>
    </div>
  );
}
