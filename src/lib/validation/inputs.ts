import { z } from "zod";

const disposalPathwaySchema = z.enum(["landfill", "combustion", "recycling"]);

export const singleUseItemSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    productionFactorId: z.string().min(1),
    massKg: z.number().positive(),
    disposalPathway: disposalPathwaySchema,
    disposalFactorId: z.string().min(1),
    recycledContentFraction: z.number().min(0).max(1).optional(),
    recycledProductionFactorId: z.string().min(1).optional(),
  })
  .refine(
    (item) =>
      !item.recycledContentFraction ||
      item.recycledContentFraction === 0 ||
      !!item.recycledProductionFactorId,
    {
      message: "recycledProductionFactorId is required when recycledContentFraction > 0",
      path: ["recycledProductionFactorId"],
    },
  );

export const reusableItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  productionFactorId: z.string().min(1),
  massKg: z.number().positive(),
  maxCycles: z.number().int().positive(),
  survivalProbability: z.number().gt(0).lte(1),
  washingEnergyFactorId: z.string().min(1),
  gridFactorId: z.string().min(1),
  itemsPerWash: z.number().positive(),
  disposalPathway: disposalPathwaySchema,
  disposalFactorId: z.string().min(1),
  returnTransportPerUseKgCo2e: z.number().nonnegative().optional(),
});

export const transportInputSchema = z.object({
  factorId: z.string().min(1),
  distanceKm: z.number().nonnegative(),
  isDefaultAssumption: z.boolean(),
});

export type SingleUseItemParsed = z.infer<typeof singleUseItemSchema>;
export type ReusableItemParsed = z.infer<typeof reusableItemSchema>;
export type TransportInputParsed = z.infer<typeof transportInputSchema>;
