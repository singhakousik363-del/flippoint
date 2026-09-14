import { ArrowRightIcon, PackageIcon, SlidersHorizontalIcon, ZapIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getMaterial } from "@/lib/data/catalog";
import { createDemoDecision } from "@/lib/data/demo-decision";
import { computeDecisionResults } from "@/lib/decision/compute";
import { computeDecisionSensitivity, type SensitivityVariableResult } from "@/lib/decision/sensitivity";
import { buildScenarioDecision } from "@/lib/decision/what-if";
import type { PackagingOptionDraft } from "@/types/decision";

/** How many decimal places to round a variable's scenario value to, per kind. */
function decimalsFor(kind: SensitivityVariableResult["kind"]): number {
  return kind === "reusableMaxCycles" ? 0 : 1;
}

/** Builds the patch to apply the chosen variable's scenario value onto its option. */
function patchFor(
  variable: SensitivityVariableResult,
  option: PackagingOptionDraft,
  value: number,
): Partial<PackagingOptionDraft> {
  switch (variable.kind) {
    case "mass":
      return { massGrams: value };
    case "transportDistance":
      return { transportDistanceKm: value };
    case "recycledContent":
      return { recycledContentPct: Math.min(100, Math.max(0, value)) };
    case "reusableMaxCycles":
      return {
        reusableSettings: { ...option.reusableSettings!, maxCycles: Math.max(1, Math.round(value)) },
      };
    case "reusableLossRate":
      return {
        reusableSettings: { ...option.reusableSettings!, lossRatePct: Math.min(99.9, Math.max(0, value)) },
      };
    case "disposalPathway":
      throw new Error(
        "DecisionFlipPreview: disposalPathway break-evens are never solvable and should " +
          "never be selected as the smallest-relative-change variable.",
      );
  }
}

/**
 * Runs the seeded demo scenario through the real engine to find a genuine,
 * *plausible* flip: among every solvable break-even the sensitivity module
 * finds for this decision (across both options and every variable kind —
 * mass, transport distance, recycled content, ...), picks whichever one is
 * the smallest relative change from its current value, pushes just past
 * that threshold, and re-verifies the flip with a second real
 * `computeDecisionResults` call. Nothing here is a hand-picked or invented
 * number — if the seeded scenario stops producing a real flip, this throws
 * (failing the build) instead of silently showing a fabricated one.
 *
 * This module has no "use client" directive and the landing page is
 * statically generated, so this computation happens once at `next build`
 * and is baked into the prerendered HTML — not re-run per request.
 */
function buildFlipPreviewData() {
  const demo = createDemoDecision();
  const current = computeDecisionResults(demo);
  if (!current.bestOptionId) {
    throw new Error("DecisionFlipPreview: the seeded demo scenario has no valid current winner.");
  }

  const sensitivity = computeDecisionSensitivity(demo);
  const solvable = (sensitivity?.variables ?? []).filter(
    (v): v is SensitivityVariableResult & { breakEven: { value: number } } =>
      v.breakEven.solvable && v.breakEven.value !== null,
  );
  if (solvable.length === 0) {
    throw new Error(
      "DecisionFlipPreview: the seeded demo scenario has no solvable break-even for any " +
        "variable, so it does not produce a real flip. Fix the seeded scenario or this " +
        "preview instead of inventing one.",
    );
  }

  // Smallest relative change from the variable's current value — a change of
  // 0 has an undefined (treated as infinite) relative change, so it can
  // never be picked as "smallest."
  const relativeChange = (v: (typeof solvable)[number]) =>
    v.currentValue !== 0 ? Math.abs(v.breakEven.value - v.currentValue) / Math.abs(v.currentValue) : Infinity;
  const chosen = solvable.reduce((best, v) => (relativeChange(v) < relativeChange(best) ? v : best));

  const perturbedOption = demo.options.find((o) => o.id === chosen.optionId)!;
  const direction = Math.sign(chosen.breakEven.value - chosen.currentValue);
  if (direction === 0) {
    throw new Error(
      "DecisionFlipPreview: the chosen variable's break-even equals its current value, so no " +
        "direction of change can be determined.",
    );
  }

  // Push a further 10% of the current-to-break-even gap past the threshold,
  // then round in the same direction (away from the current value) so
  // rounding can never pull the scenario value back across the threshold.
  const gap = Math.abs(chosen.breakEven.value - chosen.currentValue);
  const overshot = chosen.breakEven.value + direction * gap * 0.1;
  const factor = 10 ** decimalsFor(chosen.kind);
  const scenarioValue = direction > 0 ? Math.ceil(overshot * factor) / factor : Math.floor(overshot * factor) / factor;

  const scenarioDecision = buildScenarioDecision(
    demo,
    perturbedOption.id,
    patchFor(chosen, perturbedOption, scenarioValue),
  );
  const scenario = computeDecisionResults(scenarioDecision);
  if (!scenario.bestOptionId || scenario.bestOptionId === current.bestOptionId) {
    throw new Error(
      "DecisionFlipPreview: patching the seeded demo scenario's smallest-relative-change " +
        "variable past its modeled break-even did not actually flip the recommendation.",
    );
  }

  const currentWinner = current.options.find((o) => o.optionId === current.bestOptionId)!;
  const scenarioWinner = scenario.options.find((o) => o.optionId === scenario.bestOptionId)!;
  const material = getMaterial(perturbedOption.materialCode);

  return {
    currentWinnerName: currentWinner.optionName,
    scenarioWinnerName: scenarioWinner.optionName,
    materialLabel: material.label,
    variableLabel: chosen.label,
    unit: chosen.unit,
    fromValue: chosen.currentValue,
    toValue: scenarioValue,
  };
}

function formatUnitValue(value: number, unit: string): string {
  const formatted = value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return unit === "%" ? `${formatted}%` : `${formatted} ${unit}`;
}

/**
 * The signature "decision flip" moment, using the real seeded demo scenario
 * computed through the actual engine (see buildFlipPreviewData above) —
 * never hardcoded option labels or invented figures.
 */
export function DecisionFlipPreview() {
  const { currentWinnerName, scenarioWinnerName, materialLabel, variableLabel, unit, fromValue, toValue } =
    buildFlipPreviewData();

  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-16">
      <div className="mx-auto mb-8 flex max-w-xl flex-col items-center gap-2 text-center">
        <Badge variant="outline">Illustrative example</Badge>
        <h2 className="text-2xl font-semibold tracking-tight">
          See the moment your decision flips
        </h2>
        <p className="text-muted-foreground">
          When a real assumption crosses its modeled threshold, FlipPoint shows exactly what
          changed, why, and what the new recommendation is — using the numbers already in your
          comparison, never invented ones.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-warning/40 bg-warning/[0.06] p-5">
        <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div className="flex flex-col gap-1 text-center sm:text-left">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Current
            </span>
            <p className="text-base font-semibold">{currentWinnerName} wins</p>
          </div>
          <div className="mx-auto flex size-9 items-center justify-center rounded-full border border-warning/50 bg-background text-warning">
            <ArrowRightIcon className="size-4" />
          </div>
          <div className="flex flex-col gap-1 text-center sm:text-right">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Scenario
            </span>
            <p className="text-base font-semibold">{scenarioWinnerName} wins</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border/60 pt-3.5 sm:justify-start">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
            <PackageIcon className="size-3" />
            Material: {materialLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
            <SlidersHorizontalIcon className="size-3" />
            {variableLabel}: {formatUnitValue(fromValue, unit)} <ArrowRightIcon className="size-3" />{" "}
            {formatUnitValue(toValue, unit)}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1 rounded-lg border border-warning/40 bg-warning/15 px-4 py-3 text-center sm:flex-row sm:justify-center sm:gap-2">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-warning">
            <ZapIcon className="size-4" />
            DECISION FLIPPED
          </span>
          <span className="text-sm text-warning/90">
            {scenarioWinnerName} becomes preferable instead of {currentWinnerName}.
          </span>
        </div>
      </div>
    </section>
  );
}
