"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setQuoteStatus,
  deleteQuote,
  convertToInvoice,
} from "@/app/(app)/angebote/actions";

export default function QuoteActions({
  id,
  status,
}: {
  id: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "converted";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function changeStatus(s: "draft" | "sent" | "accepted" | "rejected") {
    startTransition(async () => {
      await setQuoteStatus(id, s);
      router.refresh();
    });
  }

  function convert() {
    if (confirm("Angebot in eine Rechnung umwandeln?")) {
      startTransition(async () => {
        const res = await convertToInvoice(id);
        if (res.error) alert(res.error);
        else router.push("/invoices");
        router.refresh();
      });
    }
  }

  function remove() {
    if (confirm("Dieses Angebot löschen?")) {
      startTransition(async () => {
        const res = await deleteQuote(id);
        if (res.error) alert(res.error);
        router.refresh();
      });
    }
  }

  const converted = status === "converted";

  return (
    <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">
      <a
        href={`/angebote/${id}/pdf`}
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
        <>
          <button
            onClick={() => changeStatus("accepted")}
            disabled={pending}
            className="text-xs text-income hover:underline disabled:opacity-50"
          >
            → angenommen
          </button>
          <button
            onClick={() => changeStatus("rejected")}
            disabled={pending}
            className="text-xs text-muted hover:text-expense disabled:opacity-50"
          >
            → abgelehnt
          </button>
        </>
      )}
      {!converted && (
        <button
          onClick={convert}
          disabled={pending}
          className="text-xs font-medium text-brand hover:underline disabled:opacity-50"
          title="In Rechnung umwandeln"
        >
          → Rechnung
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
