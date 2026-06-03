"use client";

import { useTransition } from "react";
import { cancelTransaction } from "@/app/(app)/transactions/actions";

export default function StornoButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (
      confirm(
        "Buchung stornieren? (GoBD: sie wird nicht gelöscht, sondern als storniert markiert.)",
      )
    ) {
      startTransition(() => {
        cancelTransaction(id);
      });
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="text-xs text-muted underline-offset-2 hover:text-expense hover:underline disabled:opacity-50"
    >
      {pending ? "…" : "Storno"}
    </button>
  );
}
