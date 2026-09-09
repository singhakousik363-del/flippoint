import { z } from "zod";

const materialCodeSchema = z.enum(["PET", "HDPE", "PP"]);
const disposalPathwaySchema = z.enum(["landfill", "combustion", "recycling"]);

export const reusableSettingsDraftSchema = z.object({
  maxCycles: z
    .number({ error: "Enter the rated number of wash cycles" })
    .int("Must be a whole number")
    .positive("Must be at least 1"),
  lossRatePct: z
    .number({ error: "Enter a loss rate" })
    .min(0, "Loss rate cannot be negative")
    .lt(100, "Loss rate must be less than 100%"),
  itemsPerWash: z
    .number({ error: "Enter items per wash" })
    .positive("Must be greater than 0"),
  returnTransportPerUseKgCo2e: z
    .number({ error: "Enter a value (0 if not applicable)" })
    .min(0, "Cannot be negative"),
});

export const packagingOptionDraftSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1, "Option name is required"),
    materialCode: materialCodeSchema,
    massGrams: z.number({ error: "Enter a mass" }).positive("Mass must be greater than 0"),
    recycledContentPct: z
      .number({ error: "Enter a recycled-content percentage" })
      .min(0, "Cannot be negative")
      .max(100, "Cannot exceed 100%"),
    transportFactorId: z.string().min(1, "Choose a transport mode"),
    transportDistanceKm: z
      .number({ error: "Enter a transport distance" })
      .positive("Transport distance must be greater than 0"),
    disposalPathway: disposalPathwaySchema,
    reusable: z.boolean(),
    reusableSettings: reusableSettingsDraftSchema.nullable(),
  })
  .refine((o) => !o.reusable || o.reusableSettings !== null, {
    message: "Reusable settings are required when this option is marked reusable",
    path: ["reusableSettings"],
  });

export const decisionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Decision name is required"),
  businessContext: z.string().max(2000, "Keep this under 2000 characters"),
  annualVolume: z
    .number({ error: "Enter an annual volume" })
    .positive("Annual volume must be greater than 0"),
  options: z
    .array(packagingOptionDraftSchema)
    .min(2, "Add at least 2 options to compare")
    .max(4, "You can compare up to 4 options"),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PackagingOptionDraftParsed = z.infer<typeof packagingOptionDraftSchema>;
export type DecisionParsed = z.infer<typeof decisionSchema>;

/** Flattened field-level error messages, keyed by a dot path (e.g. "options.0.massGrams"). */
export function flattenIssues(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    out[issue.path.join(".")] = issue.message;
  }
  return out;
}
