import type { DecisionResults, OptionResult } from "@/lib/decision/compute";

export interface ImpactDifference {
  bestOptionId: string;
  bestOptionName: string;
  runnerUpOptionId: string;
  runnerUpOptionName: string;
  /** Runner-up minus best, per unit (or per use) — always >= 0 since best is the lowest-impact option. */
  perUnitDifference: number;
  /** Runner-up minus best, annualized — always >= 0. */
  annualDifference: number;
}

/**
 * Compares the recommended (best) option against its closest competitor —
 * the lowest-impact option among the rest — using figures already present on
 * DecisionResults. Reuses results.bestOptionId rather than re-deriving it, and
 * performs no engine calculation of its own; it only reads and subtracts
 * already-computed perUnitImpact/annualImpact values.
 */
export function computeImpactDifference(results: DecisionResults): ImpactDifference | null {
  const valid = results.options.filter((o) => !o.error);
  if (valid.length < 2 || !results.bestOptionId) return null;

  const best = valid.find((o) => o.optionId === results.bestOptionId);
  if (!best) return null;

  const runnerUp = valid
    .filter((o) => o.optionId !== best.optionId)
    .reduce<OptionResult | null>(
      (closest, o) => (!closest || o.perUnitImpact.central < closest.perUnitImpact.central ? o : closest),
      null,
    );
  if (!runnerUp) return null;

  return {
    bestOptionId: best.optionId,
    bestOptionName: best.optionName,
    runnerUpOptionId: runnerUp.optionId,
    runnerUpOptionName: runnerUp.optionName,
    perUnitDifference: runnerUp.perUnitImpact.central - best.perUnitImpact.central,
    annualDifference: runnerUp.annualImpact.central - best.annualImpact.central,
  };
}
