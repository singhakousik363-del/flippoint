import {
  assessReusableFeasibility,
  calculateAnnualImpact,
  calculateBreakEven,
  calculateEffectiveCycles,
  calculateReusableCumulative,
  calculateReusableFixedCosts,
  calculateReusableRecurringCosts,
  calculateSingleUseImpact,
  determineConfidence,
  type ConfidenceAssessment,
  type ImpactResult,
  type ReusableFixedCosts,
  type ReusableRecurringCosts,
  type SingleUseImpactBreakdown,
} from "@/lib/engine/engine";
import { getFactor } from "@/lib/engine/normalize";
import { mapOptionToEngineInputs } from "@/lib/decision/map-to-engine";
import type { Decision, PackagingOptionDraft } from "@/types/decision";
import type { BreakEvenResult, ReusableFeasibility } from "@/lib/engine/engine";
import type { EmissionFactor } from "@/types/domain";

export interface ReusableResult {
  fixed: ReusableFixedCosts;
  recurring: ReusableRecurringCosts;
  effectiveCycles: number;
  impactPerUseAtEffectiveLifetime: number;
  breakEvenVsLowestSingleUse: (BreakEvenResult & { comparatorOptionName: string }) | null;
  feasibility: ReusableFeasibility | null;
}

export interface OptionResult {
  optionId: string;
  optionName: string;
  isReusable: boolean;
  singleUse: SingleUseImpactBreakdown | null;
  reusable: ReusableResult | null;
  /** Unified per-unit (or per-use) figure used for ranking and comparison. */
  perUnitImpact: ImpactResult;
  annualImpact: ImpactResult;
  confidenceVsBestOption: ConfidenceAssessment | null;
  /** Every sourced factor that fed this option's calculation, for provenance display. */
  factorsUsed: EmissionFactor[];
  error: string | null;
}

export interface DecisionResults {
  decisionId: string;
  options: OptionResult[];
  bestOptionId: string | null;
  computedAt: string;
}

function computeSingleOption(option: PackagingOptionDraft): OptionResult {
  try {
    const mapped = mapOptionToEngineInputs(option);

    if (mapped.kind === "single-use") {
      const breakdown = calculateSingleUseImpact(mapped.item, mapped.transport);
      return {
        optionId: option.id,
        optionName: option.name,
        isReusable: false,
        singleUse: breakdown,
        reusable: null,
        perUnitImpact: breakdown.total,
        annualImpact: { central: 0, confidence: breakdown.total.confidence }, // filled in later
        confidenceVsBestOption: null,
        factorsUsed: breakdown.factorsUsed,
        error: null,
      };
    }

    const fixed = calculateReusableFixedCosts(mapped.item, mapped.transport);
    const recurring = calculateReusableRecurringCosts(mapped.item);
    const effectiveCycles = calculateEffectiveCycles(
      mapped.item.maxCycles,
      mapped.item.survivalProbability,
    );
    const cumulativeAtEffectiveLifetime = calculateReusableCumulative(
      fixed,
      recurring,
      effectiveCycles,
    );
    const impactPerUseAtEffectiveLifetime = cumulativeAtEffectiveLifetime / effectiveCycles;

    const perUnitImpact: ImpactResult = {
      central: impactPerUseAtEffectiveLifetime,
      // Derived from a ratio of point estimates — no source-stated range to carry through.
      confidence: "low",
    };

    const factorsUsed = [
      getFactor(mapped.item.productionFactorId),
      getFactor(mapped.transport.factorId),
      getFactor(mapped.item.disposalFactorId),
      getFactor(mapped.item.washingEnergyFactorId),
      getFactor(mapped.item.gridFactorId),
    ];

    return {
      optionId: option.id,
      optionName: option.name,
      isReusable: true,
      singleUse: null,
      reusable: {
        fixed,
        recurring,
        effectiveCycles,
        impactPerUseAtEffectiveLifetime,
        breakEvenVsLowestSingleUse: null, // filled in later, needs sibling options
        feasibility: null,
      },
      perUnitImpact,
      annualImpact: { central: 0, confidence: perUnitImpact.confidence },
      confidenceVsBestOption: null,
      factorsUsed,
      error: null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown calculation error";
    return {
      optionId: option.id,
      optionName: option.name,
      isReusable: option.reusable,
      singleUse: null,
      reusable: null,
      perUnitImpact: { central: 0, confidence: "low" },
      annualImpact: { central: 0, confidence: "low" },
      confidenceVsBestOption: null,
      factorsUsed: [],
      error: message,
    };
  }
}

/**
 * Computes comparison results for an entire decision. Pure function — no
 * store access, no side effects. This is the sole boundary between the
 * Decision Builder's draft state and the deterministic calculation engine.
 */
export function computeDecisionResults(decision: Decision): DecisionResults {
  const options = decision.options.map(computeSingleOption);

  // Annual scaling, now that every option's unit impact is known.
  for (const result of options) {
    if (result.error) continue;
    result.annualImpact = calculateAnnualImpact(result.perUnitImpact, decision.annualVolume);
  }

  // Break-even for each reusable option, against the lowest-impact single-use option present.
  const singleUseResults = options.filter((o) => !o.error && !o.isReusable && o.singleUse);
  const lowestSingleUse = singleUseResults.reduce<OptionResult | null>((best, o) => {
    if (!best) return o;
    return o.perUnitImpact.central < best.perUnitImpact.central ? o : best;
  }, null);

  for (const result of options) {
    if (result.error || !result.isReusable || !result.reusable) continue;
    if (!lowestSingleUse) continue;
    const breakEven = calculateBreakEven(
      result.reusable.fixed,
      result.reusable.recurring,
      lowestSingleUse.perUnitImpact.central,
    );
    result.reusable.breakEvenVsLowestSingleUse = {
      ...breakEven,
      comparatorOptionName: lowestSingleUse.optionName,
    };
    result.reusable.feasibility = assessReusableFeasibility(breakEven, result.reusable.effectiveCycles);
  }

  // Confidence of each option relative to the best (lowest central-impact) option.
  const valid = options.filter((o) => !o.error);
  const bestOption = valid.reduce<OptionResult | null>((best, o) => {
    if (!best) return o;
    return o.perUnitImpact.central < best.perUnitImpact.central ? o : best;
  }, null);

  if (bestOption) {
    for (const result of valid) {
      if (result.optionId === bestOption.optionId) continue;
      result.confidenceVsBestOption = determineConfidence(
        bestOption.perUnitImpact,
        result.perUnitImpact,
        {
          sourceQualityFlag:
            (result.singleUse?.flags.recycledContentInterpolated ?? false) ||
            (bestOption.singleUse?.flags.recycledContentInterpolated ?? false),
        },
      );
    }
  }

  return {
    decisionId: decision.id,
    options,
    bestOptionId: bestOption?.optionId ?? null,
    computedAt: new Date().toISOString(),
  };
}
