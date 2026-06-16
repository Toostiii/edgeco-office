import { z } from "zod";

export const quoteLineSchema = z.object({
  description: z.string().trim().min(1, "Beschreibung fehlt."),
  quantity: z.number().int().positive("Menge muss > 0 sein."),
  unitPriceCents: z.number().int().nonnegative("Preis ungültig."),
});

export const quoteSchema = z.object({
  customerId: z.string().uuid("Bitte einen Kunden wählen."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum."),
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum.")
    .nullable()
    .optional(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  lines: z.array(quoteLineSchema).min(1, "Mindestens eine Position."),
});

export type QuoteInput = z.infer<typeof quoteSchema>;
