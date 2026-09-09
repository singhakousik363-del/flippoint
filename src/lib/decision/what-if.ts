import { computeDecisionResults, type DecisionResults } from "@/lib/decision/compute";
import type { Decision, PackagingOptionDraft } from "@/types/decision";

export interface WhatIfComparison {
  perturbedOptionId: string;
  currentResults: DecisionResults;
  scenarioResults: DecisionResults;
  currentBestOptionId: string | null;
  scenarioBestOptionId: string | null;
  flips: boolean;
  /** scenario per-unit impact minus current per-unit impact, for the perturbed option. */
  deltaPerUnitImpact: number;
}

/** Returns a new Decision with one option patched — does not mutate the input
 *  and never touches the persisted store. Pure data transformation only. */
export function buildScenarioDecision(
  decision: Decision,
  optionId: string,
  patch: Partial<PackagingOptionDraft>,
): Decision {
  return {
    ...decision,
    options: decision.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)),
  };
}

/**
 * Recomputes the whole decision under a hypothetical patch to one option and
 * compares it against the current (unpatched) decision. This is the sole
 * calculation boundary for the What-If simulator — it delegates entirely to
 * computeDecisionResults (the same function the Comparison Workspace uses),
 * so the simulator can never drift from the real engine's numbers.
 */
export function compareWhatIf(
  decision: Decision,
  optionId: string,
  patch: Partial<PackagingOptionDraft>,
): WhatIfComparison {
  const scenarioDecision = buildScenarioDecision(decision, optionId, patch);
  const currentResults = computeDecisionResults(decision);
  const scenarioResults = computeDecisionResults(scenarioDecision);

  const currentOption = currentResults.options.find((o) => o.optionId === optionId);
  const scenarioOption = scenarioResults.options.find((o) => o.optionId === optionId);

  return {
    perturbedOptionId: optionId,
    currentResults,
    scenarioResults,
    currentBestOptionId: currentResults.bestOptionId,
    scenarioBestOptionId: scenarioResults.bestOptionId,
    flips: currentResults.bestOptionId !== scenarioResults.bestOptionId,
    deltaPerUnitImpact:
      (scenarioOption?.perUnitImpact.central ?? 0) - (currentOption?.perUnitImpact.central ?? 0),
  };
}
