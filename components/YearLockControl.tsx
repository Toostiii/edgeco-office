"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { lockYear, unlockYear } from "@/app/(app)/reports/lock-actions";

export default function YearLockControl({
  year,
  locked,
}: {
  year: number;
  locked: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function lock() {
    if (
      confirm(
        `Jahr ${year} festschreiben?\n\nDanach können Buchungen dieses Jahres nicht mehr geändert, gelöscht oder neu angelegt werden (GoBD).`,
      )
    ) {
      startTransition(async () => {
        await lockYear(year);
        router.refresh();
      });
    }
  }

  function unlock() {
    if (
      confirm(
        `Festschreibung für ${year} aufheben?\n\nGoBD rät davon ab — nur in begründeten Ausnahmefällen.`,
      )
    ) {
      startTransition(async () => {
        await unlockYear(year);
        router.refresh();
      });
    }
  }

  if (locked) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-income/10 px-3 py-2 text-sm font-medium text-income">
          🔒 {year} festgeschrieben
        </span>
        <button
          onClick={unlock}
          disabled={pending}
          className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
        >
          Aufheben
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={lock}
      disabled={pending}
      className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:bg-black/5 disabled:opacity-50"
    >
      {pending ? "…" : `🔓 ${year} festschreiben`}
    </button>
  );
}
