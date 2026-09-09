import type { WhatIfComparison } from "@/lib/decision/what-if";
import type { SensitivityVariableResult } from "@/lib/decision/sensitivity";
import type { PackagingOptionDraft, ReusableSettingsDraft } from "@/types/decision";

export interface ChangedField {
  label: string;
  from: string;
  to: string;
}

export interface FlipThreshold {
  value: number;
  unit: string;
  formatted: string;
}

export interface FlipExplanation {
  previousWinnerName: string;
  newWinnerName: string;
  /** Label of the first changed field, or null if nothing was tracked as changed. */
  primaryVariableLabel: string | null;
  previousValue: string | null;
  scenarioValue: string | null;
  /** The deterministic break-even for the primary variable, when solvable. */
  threshold: FlipThreshold | null;
  sentence: string;
}

/** Same rounding convention used across the sensitivity/what-if panels, so a
 *  threshold reads identically wherever it's displayed. */
export function formatThresholdValue(v: number, unit: string): string {
  const rounded = unit === "%" || unit === "km" || unit === "g" ? v.toFixed(1) : v.toFixed(0);
  return `${rounded}${unit ? ` ${unit}` : ""}`;
}

interface ScenarioSliders {
  massGrams: number;
  transportDistanceKm: number;
  recycledContentPct: number;
  reusableSettings: ReusableSettingsDraft | null;
}

/**
 * Diffs the what-if sliders against the option's original values, producing
 * the plain-English "changed field" list the flip explanation and the
 * simulator's chip row both read from. The sole source of this diff — never
 * recomputed independently elsewhere.
 */
export function computeChangedFields(
  option: PackagingOptionDraft,
  sliders: ScenarioSliders,
  opts: { supportsRecycledContent: boolean; isReusable: boolean },
): ChangedField[] {
  const changed: ChangedField[] = [];

  if (Math.abs(sliders.massGrams - option.massGrams) > 1e-6) {
    changed.push({
      label: "Item mass",
      from: `${option.massGrams.toFixed(1)} g`,
      to: `${sliders.massGrams.toFixed(1)} g`,
    });
  }

  const originalDistance = option.transportDistanceKm ?? 0;
  if (Math.abs(sliders.transportDistanceKm - originalDistance) > 1e-6) {
    changed.push({
      label: "Transport distance",
      from: `${originalDistance.toFixed(0)} km`,
      to: `${sliders.transportDistanceKm.toFixed(0)} km`,
    });
  }

  if (
    opts.supportsRecycledContent &&
    Math.abs(sliders.recycledContentPct - option.recycledContentPct) > 1e-6
  ) {
    changed.push({
      label: "Recycled content",
      from: `${option.recycledContentPct.toFixed(0)}%`,
      to: `${sliders.recycledContentPct.toFixed(0)}%`,
    });
  }

  if (opts.isReusable && option.reusableSettings && sliders.reusableSettings) {
    if (option.reusableSettings.maxCycles !== sliders.reusableSettings.maxCycles) {
      changed.push({
        label: "Rated reuse cycles",
        from: `${option.reusableSettings.maxCycles}`,
        to: `${sliders.reusableSettings.maxCycles}`,
      });
    }
    if (option.reusableSettings.lossRatePct !== sliders.reusableSettings.lossRatePct) {
      changed.push({
        label: "Loss rate per cycle",
        from: `${option.reusableSettings.lossRatePct.toFixed(1)}%`,
        to: `${sliders.reusableSettings.lossRatePct.toFixed(1)}%`,
      });
    }
  }

  return changed;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Builds the "Why did it flip?" explanation entirely from data the what-if
 * and sensitivity engines already produced — compareWhatIf() for the winners,
 * the changed-field diff for what moved, and the sensitivity engine's
 * break-even for the threshold. No environmental figure is computed here;
 * this only assembles and narrates values computed elsewhere.
 */
export function buildFlipExplanation(
  comparison: WhatIfComparison,
  changedFields: ChangedField[],
  primaryThreshold: SensitivityVariableResult | null,
): FlipExplanation | null {
  if (!comparison.flips) return null;

  const previousWinner = comparison.currentResults.options.find(
    (o) => o.optionId === comparison.currentBestOptionId,
  );
  const newWinner = comparison.scenarioResults.options.find(
    (o) => o.optionId === comparison.scenarioBestOptionId,
  );
  if (!previousWinner || !newWinner) return null;

  const primary = changedFields[0] ?? null;

  const threshold =
    primaryThreshold && primaryThreshold.breakEven.solvable && primaryThreshold.breakEven.value !== null
      ? {
          value: primaryThreshold.breakEven.value,
          unit: primaryThreshold.unit,
          formatted: formatThresholdValue(primaryThreshold.breakEven.value, primaryThreshold.unit),
        }
      : null;

  const changeClause = primary
    ? `changing ${primary.label.toLowerCase()} from ${primary.from} to ${primary.to}`
    : "this scenario";
  const thresholdClause = threshold ? `, crossing the modeled break-even at ${threshold.formatted}` : "";

  const sentence =
    `${capitalize(changeClause)} shifts the recommendation from ${previousWinner.optionName} ` +
    `to ${newWinner.optionName}${thresholdClause}.`;

  return {
    previousWinnerName: previousWinner.optionName,
    newWinnerName: newWinner.optionName,
    primaryVariableLabel: primary?.label ?? null,
    previousValue: primary?.from ?? null,
    scenarioValue: primary?.to ?? null,
    threshold,
    sentence,
  };
}
