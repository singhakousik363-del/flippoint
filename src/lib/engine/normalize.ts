import rawFactors from "@/lib/data/emission-factors.json";
import { emissionFactorSetSchema } from "@/lib/validation/emission-factor";
import { PENDING_FACTORS } from "@/lib/data/pending-factors";
import type { EmissionFactor } from "@/types/domain";

/** Thrown when the engine is asked to calculate using a factor id that does not
 *  exist in the verified dataset. Never falls back to a default or estimated
 *  value — the caller must supply a verified factor or surface this error. */
export class MissingFactorError extends Error {
  constructor(public readonly factorId: string) {
    const pending = PENDING_FACTORS.find((p) => p.id === factorId);
    const reason = pending
      ? ` This factor is a known pending item: ${pending.reason}`
      : "";
    super(`No verified emission factor found for id "${factorId}".${reason}`);
    this.name = "MissingFactorError";
  }
}

const parsed = emissionFactorSetSchema.safeParse(rawFactors);
if (!parsed.success) {
  throw new Error(
    `emission-factors.json failed schema validation: ${parsed.error.message}`,
  );
}

const FACTORS_BY_ID = new Map<string, EmissionFactor>(
  parsed.data.map((f) => [f.id, f as EmissionFactor]),
);

/** Look up a verified emission factor by id. Throws MissingFactorError if absent
 *  — the engine never silently substitutes a default. */
export function getFactor(id: string): EmissionFactor {
  const factor = FACTORS_BY_ID.get(id);
  if (!factor) throw new MissingFactorError(id);
  return factor;
}

export function listFactors(): EmissionFactor[] {
  return Array.from(FACTORS_BY_ID.values());
}

/** 1 metric tonne = 1000 kg. Converts a per-tonne.km transport factor to per-kg.km. */
export function transportFactorPerKgKm(factor: EmissionFactor): number {
  if (factor.category !== "transport") {
    throw new Error(`Factor "${factor.id}" is not a transport factor (category=${factor.category}).`);
  }
  if (factor.unit !== "kgCO2e/tonne.km") {
    throw new Error(
      `Unsupported transport factor unit "${factor.unit}" for "${factor.id}"; expected "kgCO2e/tonne.km".`,
    );
  }
  return factor.value / 1000;
}

/**
 * Combines a washing-energy factor (kWh/rack), a grid-electricity factor
 * (kgCO2e/kWh), and the number of items washed per rack into a per-item
 * washing emissions figure (kgCO2e/item).
 */
export function washingEmissionsPerItem(
  washingFactor: EmissionFactor,
  gridFactor: EmissionFactor,
  itemsPerWash: number,
): number {
  if (washingFactor.category !== "reuse-washing") {
    throw new Error(
      `Factor "${washingFactor.id}" is not a reuse-washing factor (category=${washingFactor.category}).`,
    );
  }
  if (washingFactor.unit !== "kWh/rack") {
    throw new Error(
      `Unsupported washing factor unit "${washingFactor.unit}" for "${washingFactor.id}"; expected "kWh/rack".`,
    );
  }
  if (gridFactor.category !== "grid-electricity") {
    throw new Error(
      `Factor "${gridFactor.id}" is not a grid-electricity factor (category=${gridFactor.category}).`,
    );
  }
  if (gridFactor.unit !== "kgCO2e/kWh") {
    throw new Error(
      `Unsupported grid factor unit "${gridFactor.unit}" for "${gridFactor.id}"; expected "kgCO2e/kWh".`,
    );
  }
  if (itemsPerWash <= 0) {
    throw new Error("itemsPerWash must be > 0");
  }
  return (washingFactor.value * gridFactor.value) / itemsPerWash;
}

/**
 * Linearly interpolates a production factor between a virgin and a
 * 100%-recycled factor at recycled-content fraction R (methodology §6).
 * Both factors must share the same unit.
 */
export function interpolateRecycledContent(
  virginFactor: EmissionFactor,
  recycledFactor: EmissionFactor,
  recycledContentFraction: number,
): number {
  if (recycledContentFraction < 0 || recycledContentFraction > 1) {
    throw new Error("recycledContentFraction must be between 0 and 1");
  }
  if (virginFactor.unit !== recycledFactor.unit) {
    throw new Error(
      `Cannot interpolate factors with mismatched units: "${virginFactor.unit}" vs "${recycledFactor.unit}".`,
    );
  }
  return (
    recycledContentFraction * recycledFactor.value +
    (1 - recycledContentFraction) * virginFactor.value
  );
}
