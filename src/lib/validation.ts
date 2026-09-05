import { z } from "zod";

const optionalText = z.string().trim().max(500).optional().transform((v) => v || null);
export const itemSchema = z.object({
  wo_number: optionalText, material_number: optionalText,
  material_description: z.string().trim().max(1000).optional().transform((v) => v || null),
  location: optionalText,
  quantity: z.union([z.literal(""), z.coerce.number().int().min(0).max(2147483647)]).optional().transform((v) => v === "" || v === undefined ? null : v),
  condition: z.enum(["New", "Good", "Requires Inspection"]),
  notes: z.string().trim().max(5000).optional().transform((v) => v || null),
});

export const movementSchema = z.object({ quantity: z.coerce.number().int().positive().optional(), note: z.string().trim().max(1000).optional().transform((v) => v || null) });
