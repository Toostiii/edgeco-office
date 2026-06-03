"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setInvoiceStatus,
  deleteInvoice,
} from "@/app/(app)/invoices/actions";

export default function InvoiceActions({
  id,
  status,
}: {
  id: string;
  status: "draft" | "sent" | "paid" | "cancelled";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function changeStatus(s: "draft" | "sent" | "paid") {
    startTransition(async () => {
      await setInvoiceStatus(id, s);
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
