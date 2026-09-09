import { z } from "zod";

/**
 * Every emission factor used by the engine must satisfy this schema.
 * A factor with no source-stated uncertainty range must be marked
 * confidence "low" — we never fabricate a range to unlock a higher tier.
 */
export const uncertaintyRangeSchema = z
  .object({
    low: z.number().optional(),
    high: z.number().optional(),
    distribution: z.enum(["uniform", "triangular", "normal"]).optional(),
    confidence: z.enum(["high", "medium", "low"]),
  })
  .refine((u) => (u.low === undefined) === (u.high === undefined), {
    message: "low and high must both be present or both be absent",
  })
  .refine((u) => (u.low === undefined && u.high === undefined ? u.confidence === "low" : true), {
    message: "a factor with no source-stated range cannot claim confidence above 'low'",
  });

export const emissionFactorSourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  publicationYear: z.number().int().min(1990).max(2100),
  accessedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "accessedDate must be YYYY-MM-DD"),
});

export const emissionFactorSchema = z
  .object({
    id: z.string().min(1),
    material: z.string().min(1),
    category: z.enum(["production", "transport", "disposal", "reuse-washing", "grid-electricity"]),
    subCategory: z.string().optional(),
    value: z.number(),
    unit: z.string().min(1),
    uncertainty: uncertaintyRangeSchema,
    source: emissionFactorSourceSchema,
    calculationBasis: z.string().min(1),
    assumptions: z.array(z.string()),
    gwpTimeHorizon: z.enum(["GWP20", "GWP100"]).optional(),
    region: z.string().optional(),
  })
  .refine((f) => f.uncertainty.low === undefined || f.uncertainty.low <= f.value, {
    message: "uncertainty.low must be <= value",
  })
  .refine((f) => f.uncertainty.high === undefined || f.uncertainty.high >= f.value, {
    message: "uncertainty.high must be >= value",
  });

export const emissionFactorSetSchema = z.array(emissionFactorSchema);

export type EmissionFactorParsed = z.infer<typeof emissionFactorSchema>;
