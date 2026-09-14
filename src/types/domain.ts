/**
 * Core domain types for the FlipPoint calculation engine.
 * Canonical internal units: mass = kg, distance = km, energy = kWh, emissions = kgCO2e.
 */

export type EmissionFactorCategory =
  | "production"
  | "transport"
  | "disposal"
  | "reuse-washing"
  | "grid-electricity";

export type DisposalPathway = "landfill" | "combustion" | "recycling";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface UncertaintyRange {
  /** Lower bound, only present if the source states one. */
  low?: number;
  /** Upper bound, only present if the source states one. */
  high?: number;
  distribution?: "uniform" | "triangular" | "normal";
  /**
   * "low" whenever the source provides no explicit range (low/high absent) —
   * confidence is never upgraded past what the source actually supports.
   */
  confidence: ConfidenceLevel;
}

export interface EmissionFactorSource {
  name: string;
  url: string;
  publicationYear: number;
  accessedDate: string;
}

export interface EmissionFactor {
  id: string;
  material: string;
  category: EmissionFactorCategory;
  subCategory?: string;
  /** Central estimate, in the source's native unit (see `unit`). */
  value: number;
  /** Native unit as published by the source, e.g. "kgCO2e/kg", "kgCO2e/tonne.km". */
  unit: string;
  /** Uncertainty band around `value`. */
  uncertainty: UncertaintyRange;
  source: EmissionFactorSource;
  calculationBasis: string;
  assumptions: string[];
  gwpTimeHorizon?: "GWP20" | "GWP100";
  region?: string;
}

/** A packaging item as configured by the user for a single-use comparison. */
export interface SingleUseItem {
  id: string;
  label: string;
  /** Emission-factor id for production (category: "production"). */
  productionFactorId: string;
  /** Item mass, kg. */
  massKg: number;
  disposalPathway: DisposalPathway;
  /** Emission-factor id for the chosen disposal pathway (category: "disposal"). */
  disposalFactorId: string;
  /** Recycled-content fraction, 0..1. When set, requires a virgin and a 100%-recycled
   *  production factor to interpolate between (see engine.interpolateRecycledContent). */
  recycledContentFraction?: number;
  /** Emission-factor id for 100% recycled-content production, required if
   *  recycledContentFraction is set and > 0. */
  recycledProductionFactorId?: string;
}

/** A reusable packaging item, modeled per §2 of the approved methodology. */
export interface ReusableItem {
  id: string;
  label: string;
  productionFactorId: string;
  massKg: number;
  /** Manufacturer-rated maximum number of cycles before retirement. */
  maxCycles: number;
  /** Per-cycle survival probability (1 - loss/breakage rate), 0 < p <= 1. */
  survivalProbability: number;
  /** Emission-factor id for washing energy (category: "reuse-washing"), kWh/rack. */
  washingEnergyFactorId: string;
  /** Emission-factor id for grid electricity (category: "grid-electricity"), kgCO2e/kWh. */
  gridFactorId: string;
  /** Number of items washed per rack/cycle — a product-specific input, not a sourced factor. */
  itemsPerWash: number;
  /** End-of-life disposal pathway for the reusable item itself, once retired. */
  disposalPathway: DisposalPathway;
  disposalFactorId: string;
  /** Optional recurring return-logistics impact per use, kgCO2e. 0 if not applicable. */
  returnTransportPerUseKgCo2e?: number;
}

export interface TransportInput {
  /** Emission-factor id for transport (category: "transport"), kgCO2e/tonne.km. */
  factorId: string;
  /** Distance, km. */
  distanceKm: number;
  /** True if the distance was not supplied by the user and a default was substituted. */
  isDefaultAssumption: boolean;
}
