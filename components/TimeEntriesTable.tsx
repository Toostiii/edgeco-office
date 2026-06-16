"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteTimeEntry,
  markInvoiced,
} from "@/app/(app)/zeiterfassung/actions";
import { formatEuro } from "@/lib/money";

export type TimeEntryRow = {
  id: string;
  date: string;
  customerName: string | null;
  description: string;
  minutes: number;
  hourlyRateCents: number;
  totalCents: number;
  status: "open" | "invoiced";
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export default function TimeEntriesTable({ rows }: { rows: TimeEntryRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const openRows = rows.filter((r) => r.status === "open");

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(r.id) && r.status === "open"),
    [rows, selected],
  );
  const selectedTotal = selectedRows.reduce((s, r) => s + r.totalCents, 0);

  function remove(id: string) {
    if (confirm("Diesen Zeiteintrag löschen?")) {
      startTransition(async () => {
        const res = await deleteTimeEntry(id);
        if (res.error) alert(res.error);
        router.refresh();
      });
    }
  }

  function intoInvoice() {
    const ids = selectedRows.map((r) => r.id);
    if (ids.length === 0) return;
    // Vorausfüllung der Rechnung: Beschreibung + Betrag als Query-Params.
    const desc = selectedRows
      .map((r) => `${r.description} (${formatDuration(r.minutes)} h)`)
      .join("; ");
    startTransition(async () => {
      const res = await markInvoiced(ids);
      if (res.error) {
        alert(res.error);
        return;
      }
      const params = new URLSearchParams({
        fromTime: "1",
        description: desc,
        amount: (selectedTotal / 100).toFixed(2),
      });
      router.push(`/invoices?${params.toString()}`);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold">Zeiteinträge ({rows.length})</h2>
        {openRows.length > 0 && (
          <button
            onClick={intoInvoice}
            disabled={pending || selectedRows.length === 0}
            className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {selectedRows.length > 0
              ? `${selectedRows.length} in Rechnung aufnehmen · ${formatEuro(selectedTotal)}`
              : "In Rechnung aufnehmen"}
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          Noch keine Zeiteinträge erfasst.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-2"></th>
                <th className="py-2 pr-3">Datum</th>
                <th className="py-2 pr-3">Kunde</th>
                <th className="py-2 pr-3">Beschreibung</th>
                <th className="py-2 pr-3 text-right">Dauer</th>
                <th className="py-2 pr-3 text-right">Satz</th>
                <th className="py-2 pr-3 text-right">Betrag</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="py-2 pr-2">
                    {r.status === "open" && (
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                      />
                    )}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {formatDate(r.date)}
                  </td>
                  <td className="py-2 pr-3">{r.customerName ?? "—"}</td>
                  <td className="py-2 pr-3">{r.description}</td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">
                    {formatDuration(r.minutes)}
                  </td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">
                    {formatEuro(r.hourlyRateCents)}
                  </td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap font-medium">
                    {formatEuro(r.totalCents)}
                  </td>
                  <td className="py-2 pr-3">
                    {r.status === "invoiced" ? (
                      <span className="rounded-full bg-income/10 px-2 py-0.5 text-xs font-medium text-income">
                        Abgerechnet
                      </span>
                    ) : (
                      <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-muted">
                        Offen
                      </span>
                    )}
                  </td>
                  <td className="py-2">
                    {r.status === "open" && (
                      <button
                        onClick={() => remove(r.id)}
                        disabled={pending}
                        className="text-xs text-muted underline-offset-2 hover:text-expense hover:underline disabled:opacity-50"
                      >
                        Löschen
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
