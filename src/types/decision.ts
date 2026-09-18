import type { DisposalPathway } from "@/types/domain";

export type MaterialCode = "PET" | "HDPE" | "PP" | "PAPERBOARD";

export interface ReusableSettingsDraft {
  /** Manufacturer-rated maximum number of wash cycles before retirement. */
  maxCycles: number;
  /** Per-cycle loss/breakage rate, 0-100 (UI unit; survivalProbability = 1 - lossRatePct/100). */
  lossRatePct: number;
  /** Number of items washed per rack/cycle. */
  itemsPerWash: number;
  /** Optional recurring return-logistics impact per use, kgCO2e. */
  returnTransportPerUseKgCo2e: number;
}

/** A packaging option as edited in the Decision Builder — UI-facing units
 *  (grams, percent, km), mapped into engine domain types at calculation time. */
export interface PackagingOptionDraft {
  id: string;
  name: string;
  materialCode: MaterialCode;
  /** Item mass, grams (UI unit — converted to kg for the engine). */
  massGrams: number;
  /** Recycled content, 0-100 (UI unit — converted to a 0-1 fraction). Only
   *  meaningful for materials with a verified recycled-content factor. */
  recycledContentPct: number;
  transportFactorId: string;
  /** Transport distance, km. Required — FlipPoint does not substitute an
   *  invented default distance. */
  transportDistanceKm: number | null;
  disposalPathway: DisposalPathway;
  reusable: boolean;
  reusableSettings: ReusableSettingsDraft | null;
}

export interface Decision {
  id: string;
  name: string;
  businessContext: string;
  /** Annual order volume, units/year. */
  annualVolume: number;
  options: PackagingOptionDraft[];
  createdAt: string;
  updatedAt: string;
}
