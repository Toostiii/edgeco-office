import { z } from "zod";

/** Validierung einer EÜR-Kategorie (Einnahme oder Ausgabe). */
export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name ist erforderlich.").max(120),
  direction: z.enum(["income", "expense"]),
});

export type CategoryInput = z.infer<typeof categorySchema>;
