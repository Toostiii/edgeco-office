import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Name ist erforderlich.").max(200),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Ungültige E-Mail.")
    .max(200)
    .optional()
    .or(z.literal("")),
});

export type CustomerInput = z.infer<typeof customerSchema>;
