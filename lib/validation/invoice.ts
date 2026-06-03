import { z } from "zod";

export const invoiceLineSchema = z.object({
  description: z.string().trim().min(1, "Beschreibung fehlt."),
  quantity: z.number().int().positive("Menge muss > 0 sein."),
  unitPriceCents: z.number().int().nonnegative("Preis ungültig."),
});

export const invoiceSchema = z.object({
  customerId: z.string().uuid("Bitte einen Kunden wählen."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum."),
  lines: z.array(invoiceLineSchema).min(1, "Mindestens eine Position."),
});

export type InvoiceInput = z.infer<typeof invoiceSchema>;
