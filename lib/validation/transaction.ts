import { z } from "zod";

/**
 * Validierung einer Buchung (nach dem Parsen des Formulars).
 * Betrag bereits in Cent (Integer, positiv).
 */
export const transactionSchema = z.object({
  direction: z.enum(["income", "expense"]),
  amountCents: z
    .number()
    .int("Betrag muss in ganzen Cent vorliegen.")
    .positive("Betrag muss größer als 0 sein."),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum."),
  categoryId: z.string().uuid().nullable().optional(),
  receiptId: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  paymentMethod: z.string().trim().max(100).optional().or(z.literal("")),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

/** Eine Zeile einer Splitbuchung: eigene Kategorie + eigener Betrag. */
export const splitLineSchema = z.object({
  amountCents: z
    .number()
    .int("Betrag muss in ganzen Cent vorliegen.")
    .positive("Betrag muss größer als 0 sein."),
  categoryId: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

export const splitTransactionSchema = z.object({
  direction: z.enum(["income", "expense"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum."),
  receiptId: z.string().uuid().nullable().optional(),
  paymentMethod: z.string().trim().max(100).optional().or(z.literal("")),
  lines: z
    .array(splitLineSchema)
    .min(2, "Eine Splitbuchung benötigt mindestens 2 Zeilen."),
});

export type SplitLineInput = z.infer<typeof splitLineSchema>;
export type SplitTransactionInput = z.infer<typeof splitTransactionSchema>;
