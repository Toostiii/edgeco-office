"use client";

import { useTransition } from "react";
import { deleteTransaction } from "@/app/(app)/transactions/actions";

export default function DeleteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (confirm("Diese Buchung endgültig löschen?")) {
      startTransition(() => {
        deleteTransaction(id);
      });
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="text-xs text-muted underline-offset-2 hover:text-expense hover:underline disabled:opacity-50"
    >
      {pending ? "…" : "Löschen"}
    </button>
  );
}
