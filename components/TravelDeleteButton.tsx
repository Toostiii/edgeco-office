"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTravelExpense } from "@/app/(app)/reisekosten/actions";

export default function TravelDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (confirm("Diesen Reisekosten-Eintrag löschen?")) {
      startTransition(async () => {
        const res = await deleteTravelExpense(id);
        if (res?.error) alert(res.error);
        router.refresh();
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
