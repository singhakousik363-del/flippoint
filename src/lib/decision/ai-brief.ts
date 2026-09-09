import { formatKgCo2e } from "@/lib/format";
import type { DecisionResults, OptionResult } from "@/lib/decision/compute";
import type { DecisionSensitivityResult } from "@/lib/decision/sensitivity";
import type { AiExplainRequest } from "@/lib/ai/schema";
import type { Decision } from "@/types/decision";

function optionFlags(option: OptionResult): string[] {
  const flags: string[] = [];
  if (option.singleUse?.flags.recycledContentInterpolated) {
    flags.push("recycled-content figure is interpolated, not a direct source value");
  }
  if (option.singleUse?.flags.defaultTransportAssumption) {
    flags.push("transport distance is a default assumption, not user-provided");
  }
  if (option.isReusable && option.reusable?.feasibility && !option.reusable.feasibility.feasible) {
    flags.push("break-even not expected to be reached within its realistic lifetime");
  }
  return flags;
}

/**
 * Builds the strict, pre-formatted input contract for the AI explanation
 * endpoint from already-computed deterministic results. Every number this
 * produces is a display string derived from a value the engine already
 * calculated — nothing is computed fresh here for the AI to read.
 * Returns null if there are fewer than two valid options to explain.
 */
export function buildAiExplainRequest(
  decision: Decision,
  results: DecisionResults,
  sensitivity: DecisionSensitivityResult | null,
): AiExplainRequest | null {
  const validOptions = results.options.filter((o) => !o.error);
  if (validOptions.length < 2) return null;

  const options = validOptions.map((o) => ({
    name: o.optionName,
    isBest: o.optionId === results.bestOptionId,
    isReusable: o.isReusable,
    perUnitImpactDisplay: formatKgCo2e(o.perUnitImpact.central),
    annualImpactDisplay: formatKgCo2e(o.annualImpact.central),
    confidence: o.perUnitImpact.confidence,
    productionDisplay: o.singleUse ? formatKgCo2e(o.singleUse.production.central) : undefined,
    transportDisplay: o.singleUse ? formatKgCo2e(o.singleUse.transport.central) : undefined,
    disposalDisplay: o.singleUse ? formatKgCo2e(o.singleUse.disposal.central) : undefined,
    flags: optionFlags(o),
  }));

  const bestOption = validOptions.find((o) => o.optionId === results.bestOptionId) ?? validOptions[0];

  const topSensitivityVariables = sensitivity?.variables.slice(0, 3).map((v) => ({
    label: v.label,
    swingDisplay: formatKgCo2e(v.swing),
    flipsWithinProbe: v.recommendationFlipsInRange,
  }));

  const topVar = sensitivity?.variables[0];
  const breakEven =
    topVar && topVar.kind !== "disposalPathway"
      ? {
          variableLabel: topVar.label,
          currentDisplay: `${topVar.currentValue}${topVar.unit ? ` ${topVar.unit}` : ""}`,
          solvable: topVar.breakEven.solvable,
          breakEvenDisplay:
            topVar.breakEven.solvable && topVar.breakEven.value !== null
              ? `${topVar.breakEven.value.toFixed(1)}${topVar.unit ? ` ${topVar.unit}` : ""}`
              : undefined,
          belowOptionName: topVar.breakEven.belowOptionName ?? undefined,
          aboveOptionName: topVar.breakEven.aboveOptionName ?? undefined,
          reason: topVar.breakEven.solvable ? undefined : topVar.breakEven.reason,
        }
      : undefined;

  const sourceMap = new Map<string, string>();
  for (const o of validOptions) {
    for (const f of o.factorsUsed) sourceMap.set(f.id, `${f.material}|${f.source.name}`);
  }
  const sources = Array.from(sourceMap.values())
    .slice(0, 12)
    .map((v) => {
      const [material, sourceName] = v.split("|");
      return { material, sourceName };
    });

  return {
    decisionName: decision.name,
    businessContext: decision.businessContext || undefined,
    annualVolumeDisplay: `${decision.annualVolume.toLocaleString()} units/year`,
    options,
    bestOptionName: sensitivity?.bestOptionName ?? bestOption.optionName,
    runnerUpOptionName: sensitivity?.runnerUpOptionName,
    mostSensitiveVariable: sensitivity?.mostSensitiveVariable
      ? {
          label: sensitivity.mostSensitiveVariable.label,
          swingDisplay: formatKgCo2e(sensitivity.mostSensitiveVariable.swing),
          flipsWithinProbe: sensitivity.mostSensitiveVariable.recommendationFlipsInRange,
        }
      : undefined,
    topSensitivityVariables,
    breakEven,
    sources,
  };
}
