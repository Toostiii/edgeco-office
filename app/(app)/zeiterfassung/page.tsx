/**
 * Zeiterfassung — abrechenbare Arbeitszeit erfassen und in Rechnung aufnehmen.
 */
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { timeEntries, customers } from "@/db/schema";
import { getCachedUser } from "@/lib/supabase/user";
import TimeEntryForm, {
  type CustomerOption,
} from "@/components/TimeEntryForm";
import TimeEntriesTable, {
  type TimeEntryRow,
} from "@/components/TimeEntriesTable";

export const dynamic = "force-dynamic";

export default async function ZeiterfassungPage() {
  const user = await getCachedUser();

  const [customerRows, rows] = await Promise.all([
    db
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .orderBy(asc(customers.name)) as Promise<CustomerOption[]>,
    user
      ? db
          .select({
            id: timeEntries.id,
            date: timeEntries.date,
            customerName: customers.name,
            description: timeEntries.description,
            minutes: timeEntries.minutes,
            hourlyRateCents: timeEntries.hourlyRateCents,
            totalCents: timeEntries.totalCents,
            status: timeEntries.status,
          })
          .from(timeEntries)
          .leftJoin(customers, eq(timeEntries.customerId, customers.id))
          .where(eq(timeEntries.ownerId, user.id))
          .orderBy(desc(timeEntries.date), desc(timeEntries.createdAt))
          .limit(300)
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-1 text-2xl font-bold">Zeiterfassung</h1>
      <p className="mb-6 text-sm text-muted">
        Erfasse abrechenbare Stunden und übernimm sie mit einem Klick in eine
        neue Rechnung.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <div>
          <TimeEntryForm customers={customerRows} />
        </div>
        <TimeEntriesTable rows={rows as TimeEntryRow[]} />
      </div>
    </div>
  );
}
