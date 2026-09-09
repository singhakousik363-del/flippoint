import { getFactor, interpolateRecycledContent, transportFactorPerKgKm, washingEmissionsPerItem } from "@/lib/engine/normalize";
import type {
  ConfidenceLevel,
  EmissionFactor,
  ReusableItem,
  SingleUseItem,
  TransportInput,
} from "@/types/domain";

/**
 * EcoTrace decision heuristic (not a scientific constant): a relative
 * central-estimate gap below this threshold is treated as not reliably
 * distinguishable from ordinary source-to-source dataset variance, because
 * published packaging emission factors commonly carry their own +/-15-25%
 * source uncertainty. See methodology §3.
 */
export const MATERIALITY_THRESHOLD_PCT = 20;

export interface ImpactRange {
  central: number;
  low?: number;
  high?: number;
}

export interface ImpactResult extends ImpactRange {
  confidence: ConfidenceLevel;
}

export interface SingleUseImpactBreakdown {
  production: ImpactResult;
  transport: ImpactResult;
  disposal: ImpactResult;
  total: ImpactResult;
  flags: {
    recycledContentInterpolated: boolean;
    defaultTransportAssumption: boolean;
  };
  factorsUsed: EmissionFactor[];
}

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = { low: 0, medium: 1, high: 2 };

function minConfidence(levels: ConfidenceLevel[]): ConfidenceLevel {
  if (levels.length === 0) throw new Error("minConfidence requires at least one level");
  return levels.reduce((min, l) => (CONFIDENCE_RANK[l] < CONFIDENCE_RANK[min] ? l : min));
}

function factorRange(factor: EmissionFactor, scale: number): ImpactResult {
  const hasRange = factor.uncertainty.low !== undefined && factor.uncertainty.high !== undefined;
  return {
    central: factor.value * scale,
    low: hasRange ? (factor.uncertainty.low as number) * scale : undefined,
    high: hasRange ? (factor.uncertainty.high as number) * scale : undefined,
    confidence: factor.uncertainty.confidence,
  };
}

/** Sums impact ranges. If any component lacks a low/high band, the sum has no
 *  band either — we never treat a missing range as zero-width. */
export function sumImpactRanges(ranges: ImpactResult[]): ImpactResult {
  if (ranges.length === 0) throw new Error("sumImpactRanges requires at least one range");
  const central = ranges.reduce((s, r) => s + r.central, 0);
  const confidence = minConfidence(ranges.map((r) => r.confidence));
  const anyMissing = ranges.some((r) => r.low === undefined || r.high === undefined);
  if (anyMissing) return { central, confidence };
  const low = ranges.reduce((s, r) => s + (r.low as number), 0);
  const high = ranges.reduce((s, r) => s + (r.high as number), 0);
  return { central, low, high, confidence };
}

/** Scales a range by a positive multiplier (e.g., annual volume). */
export function scaleImpactRange(range: ImpactResult, multiplier: number): ImpactResult {
  return {
    central: range.central * multiplier,
    low: range.low !== undefined ? range.low * multiplier : undefined,
    high: range.high !== undefined ? range.high * multiplier : undefined,
    confidence: range.confidence,
  };
}

// ---------------------------------------------------------------------------
// Production / transport / disposal — single-use item
// ---------------------------------------------------------------------------

export function calculateProductionImpact(item: SingleUseItem): {
  result: ImpactResult;
  interpolated: boolean;
  factorsUsed: EmissionFactor[];
} {
  const virginFactor = getFactor(item.productionFactorId);
  const hasRecycledContent =
    item.recycledContentFraction !== undefined && item.recycledContentFraction > 0;

  if (!hasRecycledContent) {
    return {
      result: factorRange(virginFactor, item.massKg),
      interpolated: false,
      factorsUsed: [virginFactor],
    };
  }

  if (!item.recycledProductionFactorId) {
    throw new Error(
      `Item "${item.id}" has recycledContentFraction set but no recycledProductionFactorId.`,
    );
  }
  const recycledFactor = getFactor(item.recycledProductionFactorId);
  const effectiveValue = interpolateRecycledContent(
    virginFactor,
    recycledFactor,
    item.recycledContentFraction as number,
  );
  // Interpolated values carry no source-stated range and are capped at "medium"
  // confidence even if both endpoints were individually "high" (methodology §6).
  const confidence = minConfidence([
    virginFactor.uncertainty.confidence,
    recycledFactor.uncertainty.confidence,
    "medium",
  ]);
  return {
    result: { central: effectiveValue * item.massKg, confidence },
    interpolated: true,
    factorsUsed: [virginFactor, recycledFactor],
  };
}

export function calculateTransportImpact(
  transport: TransportInput,
  massKg: number,
): { result: ImpactResult; factorUsed: EmissionFactor } {
  const factor = getFactor(transport.factorId);
  const scale = massKg * transport.distanceKm;
  // Factor is stored per tonne.km; dividing by 1000 gives per kg.km (normalize.transportFactorPerKgKm
  // applies the same conversion to `value` — mirrored here so low/high share the identical scale).
  const hasRange = factor.uncertainty.low !== undefined && factor.uncertainty.high !== undefined;
  const result: ImpactResult = {
    central: transportFactorPerKgKm(factor) * scale,
    low: hasRange ? ((factor.uncertainty.low as number) / 1000) * scale : undefined,
    high: hasRange ? ((factor.uncertainty.high as number) / 1000) * scale : undefined,
    confidence: factor.uncertainty.confidence,
  };
  return { result, factorUsed: factor };
}

export function calculateDisposalImpact(
  disposalFactorId: string,
  massKg: number,
): { result: ImpactResult; factorUsed: EmissionFactor } {
  const factor = getFactor(disposalFactorId);
  return { result: factorRange(factor, massKg), factorUsed: factor };
}

export function calculateSingleUseImpact(
  item: SingleUseItem,
  transport: TransportInput,
): SingleUseImpactBreakdown {
  const production = calculateProductionImpact(item);
  const transportImpact = calculateTransportImpact(transport, item.massKg);
  const disposal = calculateDisposalImpact(item.disposalFactorId, item.massKg);

  const total = sumImpactRanges([production.result, transportImpact.result, disposal.result]);

  return {
    production: production.result,
    transport: transportImpact.result,
    disposal: disposal.result,
    total,
    flags: {
      recycledContentInterpolated: production.interpolated,
      defaultTransportAssumption: transport.isDefaultAssumption,
    },
    factorsUsed: [...production.factorsUsed, transportImpact.factorUsed, disposal.factorUsed],
  };
}

/** Scenario scaling: per-unit impact x annual order volume. */
export function calculateAnnualImpact(unitTotal: ImpactResult, annualVolume: number): ImpactResult {
  if (annualVolume < 0) throw new Error("annualVolume must be >= 0");
  return scaleImpactRange(unitTotal, annualVolume);
}

// ---------------------------------------------------------------------------
// Reusable packaging — cumulative impact and break-even (methodology §2, revised)
// ---------------------------------------------------------------------------

export interface ReusableFixedCosts {
  /** Initial production impact, kgCO2e. */
  production: number;
  /** Initial inbound transport impact, kgCO2e. */
  transportInitial: number;
  /** End-of-life disposal impact of the reusable item itself, kgCO2e. */
  endOfLife: number;
}

export interface ReusableRecurringCosts {
  /** Washing impact per use, kgCO2e. */
  washingPerUse: number;
  /** Return-logistics impact per use, kgCO2e (0 if not applicable). */
  returnTransportPerUse: number;
}

export function calculateReusableFixedCosts(
  item: ReusableItem,
  transportInitial: TransportInput,
): ReusableFixedCosts {
  const production = getFactor(item.productionFactorId).value * item.massKg;
  const transportFactor = getFactor(transportInitial.factorId);
  const transportInitialImpact =
    transportFactorPerKgKm(transportFactor) * item.massKg * transportInitial.distanceKm;
  const endOfLife = getFactor(item.disposalFactorId).value * item.massKg;
  return { production, transportInitial: transportInitialImpact, endOfLife };
}

export function calculateReusableRecurringCosts(item: ReusableItem): ReusableRecurringCosts {
  const washingFactor = getFactor(item.washingEnergyFactorId);
  const gridFactor = getFactor(item.gridFactorId);
  const washingPerUse = washingEmissionsPerItem(washingFactor, gridFactor, item.itemsPerWash);
  return {
    washingPerUse,
    returnTransportPerUse: item.returnTransportPerUseKgCo2e ?? 0,
  };
}

/** Cumulative_reusable(N) = P_r + T_r + N*W + N*R_t + E_r (methodology §2). */
export function calculateReusableCumulative(
  fixed: ReusableFixedCosts,
  recurring: ReusableRecurringCosts,
  n: number,
): number {
  if (n < 0) throw new Error("n (number of uses) must be >= 0");
  return (
    fixed.production +
    fixed.transportInitial +
    n * recurring.washingPerUse +
    n * recurring.returnTransportPerUse +
    fixed.endOfLife
  );
}

/** N_effective = min(N_max, 1 / (1 - p)) — expected uses achievable before loss/breakage. */
export function calculateEffectiveCycles(maxCycles: number, survivalProbability: number): number {
  if (maxCycles <= 0) throw new Error("maxCycles must be > 0");
  if (survivalProbability <= 0 || survivalProbability > 1) {
    throw new Error("survivalProbability must be in (0, 1]");
  }
  if (survivalProbability >= 1) return maxCycles;
  return Math.min(maxCycles, 1 / (1 - survivalProbability));
}

export type BreakEvenResult =
  | { reachable: true; breakEvenUses: number }
  | { reachable: false; reason: string };

/**
 * N* = (P_r + T_r + E_r) / (singleUseImpactPerUse - W - R_t)
 * If the denominator is <= 0, the reusable item's recurring per-use cost is
 * greater than or equal to a single-use item's full impact — there is no
 * finite break-even (methodology §2, as revised).
 */
export function calculateBreakEven(
  fixed: ReusableFixedCosts,
  recurring: ReusableRecurringCosts,
  singleUseImpactPerUse: number,
): BreakEvenResult {
  const denominator =
    singleUseImpactPerUse - recurring.washingPerUse - recurring.returnTransportPerUse;
  if (denominator <= 0) {
    return {
      reachable: false,
      reason:
        "The reusable item's recurring per-use impact (washing + return transport) is greater " +
        "than or equal to a single-use item's full impact — no finite number of uses reaches break-even.",
    };
  }
  const numerator = fixed.production + fixed.transportInitial + fixed.endOfLife;
  const breakEvenUses = numerator / denominator;
  return { reachable: true, breakEvenUses };
}

export interface ReusableFeasibility {
  breakEven: BreakEvenResult;
  effectiveCycles: number;
  feasible: boolean;
  note: string;
}

/** Checks whether the break-even point (if any) falls within the item's
 *  realistic effective lifetime — kept as a separate, explicit layer on top
 *  of the closed-form break-even solve (methodology §2, as revised). */
export function assessReusableFeasibility(
  breakEven: BreakEvenResult,
  effectiveCycles: number,
): ReusableFeasibility {
  if (!breakEven.reachable) {
    return {
      breakEven,
      effectiveCycles,
      feasible: false,
      note: "No finite break-even under current assumptions.",
    };
  }
  const feasible = breakEven.breakEvenUses <= effectiveCycles;
  return {
    breakEven,
    effectiveCycles,
    feasible,
    note: feasible
      ? `Break-even at ${breakEven.breakEvenUses.toFixed(1)} uses is within the expected effective lifetime of ${effectiveCycles.toFixed(1)} uses.`
      : `Under current loss/breakage assumptions, this item is not expected to reach environmental break-even ` +
        `(needs ${breakEven.breakEvenUses.toFixed(1)} uses, expected effective lifetime is only ${effectiveCycles.toFixed(1)} uses).`,
  };
}

// ---------------------------------------------------------------------------
// Confidence tier (methodology §3, revised)
// ---------------------------------------------------------------------------

export type ConfidenceTier = "High" | "Medium" | "Low";

export interface ConfidenceAssessment {
  tier: ConfidenceTier;
  rangesOverlap: boolean;
  relativeDifferencePct: number | null;
  sourceQualityDowngraded: boolean;
  explanation: string;
}

function rangesOverlap(a: ImpactResult, b: ImpactResult): boolean | null {
  if (a.low === undefined || a.high === undefined || b.low === undefined || b.high === undefined) {
    return null; // cannot determine overlap without both ranges
  }
  return a.low <= b.high && b.low <= a.high;
}

/**
 * Deterministic confidence rule (methodology §3):
 *   1. No overlap between ranges -> High
 *   2. Overlap, relative central difference >= MATERIALITY_THRESHOLD_PCT -> Medium
 *   3. Otherwise -> Low
 *   4. Downgrade one tier if either side used an interpolated or default-assumption
 *      value, or a reusable comparison where break-even is not feasible within
 *      the effective lifetime.
 * When a range is unavailable for either side, overlap cannot be established,
 * so the rule falls back to the relative-difference/source-quality checks
 * only and never claims High.
 */
export function determineConfidence(
  a: ImpactResult,
  b: ImpactResult,
  options: { sourceQualityFlag?: boolean; materialityThresholdPct?: number } = {},
): ConfidenceAssessment {
  const threshold = options.materialityThresholdPct ?? MATERIALITY_THRESHOLD_PCT;
  const overlap = rangesOverlap(a, b);
  const maxCentral = Math.max(Math.abs(a.central), Math.abs(b.central));
  const relativeDifferencePct =
    maxCentral === 0 ? 0 : (Math.abs(a.central - b.central) / maxCentral) * 100;

  let tier: ConfidenceTier;
  if (overlap === false) {
    tier = "High";
  } else if (relativeDifferencePct >= threshold) {
    tier = "Medium";
  } else {
    tier = "Low";
  }

  const lowConfidenceInput = a.confidence === "low" || b.confidence === "low";
  const sourceQualityDowngraded = Boolean(options.sourceQualityFlag) || lowConfidenceInput;
  if (sourceQualityDowngraded && tier !== "Low") {
    tier = tier === "High" ? "Medium" : "Low";
  }

  const explanation =
    overlap === null
      ? "At least one option has no source-stated uncertainty range, so range overlap could not be assessed; " +
        "tier is based on relative central difference and source quality only."
      : overlap
        ? "The two options' uncertainty ranges overlap."
        : "The two options' uncertainty ranges do not overlap.";

  return { tier, rangesOverlap: overlap ?? false, relativeDifferencePct, sourceQualityDowngraded, explanation };
}
