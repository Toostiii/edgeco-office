import { addDaysIso } from "@/lib/calc/invoice";

/** Berechnet das nächste Fälligkeitsdatum gemäß Frequenz. */
export function nextDueDate(
  current: string,
  frequency: "monthly" | "weekly" | "yearly",
  dayOfMonth: number,
): string {
  if (frequency === "weekly") {
    return addDaysIso(current, 7);
  }
  const d = new Date(`${current}T00:00:00Z`);
  if (frequency === "yearly") {
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    return d.toISOString().slice(0, 10);
  }
  // monthly: einen Monat weiter, Tag = dayOfMonth (1-28).
  const day = Math.min(Math.max(dayOfMonth, 1), 28);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1; // 0-basiert → nächster Monat
  const nd = new Date(Date.UTC(year, month, day));
  return nd.toISOString().slice(0, 10);
}
