"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  bookRecurring,
  deleteRecurring,
  toggleRecurring,
} from "@/app/(app)/wiederkehrend/actions";

export default function RecurringActions({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function book() {
    startTransition(async () => {
      const res = await bookRecurring(id);
      if (res?.error) alert(res.error);
      router.refresh();
    });
  }

  function toggle() {
    startTransition(async () => {
      const res = await toggleRecurring(id);
      if (res?.error) alert(res.error);
      router.refresh();
    });
  }

  function remove() {
    if (!confirm("Diese Vorlage löschen?")) return;
    startTransition(async () => {
      const res = await deleteRecurring(id);
      if (res?.error) alert(res.error);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-3 whitespace-nowrap">
      <button
        onClick={book}
        disabled={pending || !active}
        title={active ? "Jetzt buchen" : "Vorlage ist deaktiviert"}
        className="text-xs font-medium text-brand underline-offset-2 hover:underline disabled:opacity-40"
      >
        Jetzt buchen
      </button>
      <button
        onClick={toggle}
        disabled={pending}
        className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
      >
        {active ? "Deaktivieren" : "Aktivieren"}
      </button>
      <button
        onClick={remove}
        disabled={pending}
        className="text-xs text-muted underline-offset-2 hover:text-expense hover:underline disabled:opacity-50"
      >
        Löschen
      </button>
    </div>
  );
}
