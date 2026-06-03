"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCategory } from "@/app/(app)/categories/actions";

export default function CategoryDeleteButton({
  id,
  inUse,
}: {
  id: string;
  inUse: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const message = inUse
      ? "Diese Kategorie wird von Buchungen verwendet und kann erst gelöscht werden, wenn keine Buchung mehr darauf verweist. Trotzdem versuchen?"
      : "Diese Kategorie löschen?";
    if (confirm(message)) {
      startTransition(async () => {
        const res = await deleteCategory(id);
        if (res.error) alert(res.error);
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
