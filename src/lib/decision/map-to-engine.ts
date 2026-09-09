import { getDisposalOptionsFor, getMaterial, GRID_FACTOR_ID, REUSE_WASHING_FACTOR_ID } from "@/lib/data/catalog";
import { reusableItemSchema, singleUseItemSchema, transportInputSchema } from "@/lib/validation/inputs";
import type { PackagingOptionDraft } from "@/types/decision";
import type { ReusableItem, SingleUseItem, TransportInput } from "@/types/domain";

export type EngineMappedOption =
  | { kind: "single-use"; item: SingleUseItem; transport: TransportInput }
  | { kind: "reusable"; item: ReusableItem; transport: TransportInput };

/**
 * Converts a UI-facing PackagingOptionDraft (grams, percent, km) into the
 * engine's canonical domain types (kg, fraction) and re-validates the result
 * against the existing Phase C Zod schemas as a final safety net before any
 * calculation runs.
 */
export function mapOptionToEngineInputs(option: PackagingOptionDraft): EngineMappedOption {
  const material = getMaterial(option.materialCode);
  const disposalOption = getDisposalOptionsFor(option.materialCode).find(
    (d) => d.pathway === option.disposalPathway,
  );
  if (!disposalOption) {
    throw new Error(
      `"${option.disposalPathway}" is not an available disposal pathway for ${material.label}.`,
    );
  }
  if (option.transportDistanceKm === null) {
    throw new Error(`Option "${option.name}" is missing a transport distance.`);
  }

  const massKg = option.massGrams / 1000;
  const recycledContentFraction = option.recycledContentPct / 100;

  const transport: TransportInput = transportInputSchema.parse({
    factorId: option.transportFactorId,
    distanceKm: option.transportDistanceKm,
    isDefaultAssumption: false,
  });

  if (!option.reusable) {
    const item: SingleUseItem = singleUseItemSchema.parse({
      id: option.id,
      label: option.name,
      productionFactorId: material.virginFactorId,
      massKg,
      disposalPathway: option.disposalPathway,
      disposalFactorId: disposalOption.factorId,
      recycledContentFraction: recycledContentFraction > 0 ? recycledContentFraction : undefined,
      recycledProductionFactorId:
        recycledContentFraction > 0 ? material.recycledFactorId : undefined,
    });
    return { kind: "single-use", item, transport };
  }

  if (!option.reusableSettings) {
    throw new Error(`Option "${option.name}" is marked reusable but has no reusable settings.`);
  }
  const survivalProbability = 1 - option.reusableSettings.lossRatePct / 100;
  const item: ReusableItem = reusableItemSchema.parse({
    id: option.id,
    label: option.name,
    productionFactorId: material.virginFactorId,
    massKg,
    maxCycles: option.reusableSettings.maxCycles,
    survivalProbability,
    washingEnergyFactorId: REUSE_WASHING_FACTOR_ID,
    gridFactorId: GRID_FACTOR_ID,
    itemsPerWash: option.reusableSettings.itemsPerWash,
    disposalPathway: option.disposalPathway,
    disposalFactorId: disposalOption.factorId,
    returnTransportPerUseKgCo2e: option.reusableSettings.returnTransportPerUseKgCo2e,
  });
  return { kind: "reusable", item, transport };
}
