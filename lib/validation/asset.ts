import { z } from "zod";

export const assetSchema = z.object({
  name: z.string().trim().min(1, "Name ist erforderlich.").max(200),
  purchaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Anschaffungsdatum."),
  costCents: z
    .number()
    .int("Anschaffungskosten müssen in ganzen Cent vorliegen.")
    .positive("Anschaffungskosten müssen größer als 0 sein."),
  usefulLifeYears: z
    .number()
    .int("Nutzungsdauer muss eine ganze Zahl sein.")
    .min(1, "Nutzungsdauer muss mindestens 1 Jahr betragen.")
    .max(50, "Nutzungsdauer darf höchstens 50 Jahre betragen."),
});

export type AssetInput = z.infer<typeof assetSchema>;
