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
  description: z.string().trim().max(500).optional().or(z.literal("")),
  paymentMethod: z.string().trim().max(100).optional().or(z.literal("")),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
