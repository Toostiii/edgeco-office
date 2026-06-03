/**
 * GoBD-Festschreibung: Helfer rund um gesperrte Geschäftsjahre.
 * Server-seitig (nutzt die DB).
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { fiscalLocks } from "@/db/schema";

export function yearOf(isoDate: string): number {
  return Number(isoDate.slice(0, 4));
}

export async function getLockedYears(ownerId: string): Promise<number[]> {
  const rows = await db
    .select({ year: fiscalLocks.year })
    .from(fiscalLocks)
    .where(eq(fiscalLocks.ownerId, ownerId));
  return rows.map((r) => r.year);
}

export async function isYearLocked(
  ownerId: string,
  year: number,
): Promise<boolean> {
  const rows = await db
    .select({ id: fiscalLocks.id })
    .from(fiscalLocks)
    .where(and(eq(fiscalLocks.ownerId, ownerId), eq(fiscalLocks.year, year)))
    .limit(1);
  return rows.length > 0;
}
