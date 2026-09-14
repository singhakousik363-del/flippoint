import {
  calculateEffectiveCycles,
  calculateReusableCumulative,
  calculateReusableFixedCosts,
  calculateReusableRecurringCosts,
  calculateSingleUseImpact,
} from "@/lib/engine/engine";
import { findRootBisection } from "@/lib/engine/sensitivity";
import { getDisposalOptionsFor, getMaterial } from "@/lib/data/catalog";
import { mapOptionToEngineInputs } from "@/lib/decision/map-to-engine";
import type { Decision, PackagingOptionDraft } from "@/types/decision";
import type { DisposalPathway } from "@/types/domain";

/**
 * FlipPoint decision heuristic (not a statistical confidence interval): each
 * user-set operational input (mass, distance, recycled content, reuse
 * assumptions) is probed at +/-20% of its current value to see how much it
 * could move the decision. This is a modeling choice, disclosed as such —
 * distinct from a source-stated emission-factor uncertainty range.
 */
export const SENSITIVITY_VARIATION_PCT = 20;

export type SensitivityVariableKind =
  | "mass"
  | "transportDistance"
  | "recycledContent"
  | "disposalPathway"
  | "reusableMaxCycles"
  | "reusableLossRate";

const VARIABLE_DISPLAY_NAME: Record<SensitivityVariableKind, string> = {
  mass: "item mass",
  transportDistance: "transport distance",
  recycledContent: "recycled content",
  disposalPathway: "disposal pathway",
  reusableMaxCycles: "rated reuse cycles",
  reusableLossRate: "loss rate per cycle",
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Chart axis label: leads with the variable (the thing the tornado ranks)
 *  so it survives truncation; the option name is secondary context. Distinct
 *  from the prose `label` field (option-first, reads naturally in a sentence). */
function axisLabel(kind: SensitivityVariableKind, optionName: string): string {
  return `${capitalize(VARIABLE_DISPLAY_NAME[kind])} — ${optionName}`;
}

export interface BreakEvenInfo {
  solvable: boolean;
  value: number | null;
  unit: string;
  /** Which option wins below the break-even value. */
  belowOptionId: string | null;
  belowOptionName: string | null;
  /** Which option wins above the break-even value. */
  aboveOptionId: string | null;
  aboveOptionName: string | null;
  /** Explanation, always populated — required whether solvable or not. */
  reason: string;
  method: "analytical" | "numerical" | "none";
}

export interface CategoricalPathwayOption {
  pathway: DisposalPathway;
  label: string;
  totalImpact: number;
  isCurrent: boolean;
}

export interface SensitivityVariableResult {
  key: string;
  optionId: string;
  optionName: string;
  kind: SensitivityVariableKind;
  /** Prose form, option-first — reads naturally in a sentence ("Option A's item mass"). */
  label: string;
  /** Chart form, variable-first — survives axis truncation ("Item mass — Option A"). */
  axisLabel: string;
  unit: string;
  currentValue: number;
  lowValue: number | null;
  highValue: number | null;
  /** best.perUnitImpact - runnerUp.perUnitImpact at current settings (always <= 0). */
  diffAtCurrent: number;
  diffAtLow: number | null;
  diffAtHigh: number | null;
  /** |diffAtHigh - diffAtLow|, or max-min across pathway options for categorical variables. */
  swing: number;
  recommendationAtLow: string | null;
  recommendationAtHigh: string | null;
  recommendationFlipsInRange: boolean;
  breakEven: BreakEvenInfo;
  assumptionNote: string;
  categoricalOptions?: CategoricalPathwayOption[];
}

export interface DecisionSensitivityResult {
  bestOptionId: string;
  bestOptionName: string;
  runnerUpOptionId: string;
  runnerUpOptionName: string;
  variables: SensitivityVariableResult[];
  mostSensitiveVariable: SensitivityVariableResult | null;
  insightStatement: string;
}

const HEURISTIC_NOTE =
  `+/-${SENSITIVITY_VARIATION_PCT}% FlipPoint sensitivity heuristic — an illustrative ` +
  "probe around your input, not a source-stated uncertainty range.";

function centralImpactOf(option: PackagingOptionDraft): number {
  const mapped = mapOptionToEngineInputs(option);
  if (mapped.kind === "single-use") {
    return calculateSingleUseImpact(mapped.item, mapped.transport).total.central;
  }
  const fixed = calculateReusableFixedCosts(mapped.item, mapped.transport);
  const recurring = calculateReusableRecurringCosts(mapped.item);
  const effectiveCycles = calculateEffectiveCycles(mapped.item.maxCycles, mapped.item.survivalProbability);
  return calculateReusableCumulative(fixed, recurring, effectiveCycles) / effectiveCycles;
}

function winnerAt(diff: number, bestId: string, runnerUpId: string): string {
  return diff < 0 ? bestId : runnerUpId;
}

/**
 * Fits an exact affine model f(x) = slope*x + intercept from two probes of a
 * function known (from the engine's formulas) to be linear in x — mass,
 * distance, and recycled-content fraction are all affine in FlipPoint's
 * production/transport/disposal formulas. Solves slope*x + intercept = target.
 */
function solveLinear(
  evalAt: (x: number) => number,
  x0: number,
  target: number,
): number | null {
  const delta = x0 !== 0 ? Math.abs(x0) * 0.01 : 1;
  const f0 = evalAt(x0);
  const f1 = evalAt(x0 + delta);
  const slope = (f1 - f0) / delta;
  if (Math.abs(slope) < 1e-12) return null;
  const intercept = f0 - slope * x0;
  return (target - intercept) / slope;
}

interface VaryContext {
  bestOption: PackagingOptionDraft;
  runnerUpOption: PackagingOptionDraft;
  bestCentral: number;
  runnerUpCentral: number;
}

/** Builds diff(x) = bestSideImpact(x) - runnerUpSideImpact(x), varying whichever
 *  option owns this variable and holding the other side at its current central value. */
function buildDiffFn(
  ctx: VaryContext,
  side: "best" | "runnerUp",
  patch: (x: number) => Partial<PackagingOptionDraft>,
): (x: number) => number {
  return (x: number) => {
    if (side === "best") {
      const patched = { ...ctx.bestOption, ...patch(x) };
      return centralImpactOf(patched) - ctx.runnerUpCentral;
    }
    const patched = { ...ctx.runnerUpOption, ...patch(x) };
    return ctx.bestCentral - centralImpactOf(patched);
  };
}

function buildContinuousVariable(
  ctx: VaryContext,
  side: "best" | "runnerUp",
  kind: SensitivityVariableKind,
  currentValue: number,
  low: number,
  high: number,
  unit: string,
  patch: (x: number) => Partial<PackagingOptionDraft>,
  breakEvenDomain: { min: number; max: number },
  method: "analytical" | "numerical",
): SensitivityVariableResult {
  const option = side === "best" ? ctx.bestOption : ctx.runnerUpOption;
  const diffFn = buildDiffFn(ctx, side, patch);

  const diffAtCurrent = ctx.bestCentral - ctx.runnerUpCentral;
  const diffAtLow = diffFn(low);
  const diffAtHigh = diffFn(high);
  const swing = Math.abs(diffAtHigh - diffAtLow);
  const recommendationAtLow = winnerAt(diffAtLow, ctx.bestOption.id, ctx.runnerUpOption.id);
  const recommendationAtHigh = winnerAt(diffAtHigh, ctx.bestOption.id, ctx.runnerUpOption.id);

  let breakEvenValue: number | null = null;
  if (method === "analytical") {
    breakEvenValue = solveLinear(diffFn, currentValue, 0);
  } else {
    const result = findRootBisection(diffFn, breakEvenDomain.min, breakEvenDomain.max);
    breakEvenValue = result.found ? result.x : null;
  }

  let breakEven: BreakEvenInfo;
  if (
    breakEvenValue === null ||
    !Number.isFinite(breakEvenValue) ||
    breakEvenValue < breakEvenDomain.min ||
    breakEvenValue > breakEvenDomain.max
  ) {
    breakEven = {
      solvable: false,
      value: null,
      unit,
      belowOptionId: null,
      belowOptionName: null,
      aboveOptionId: null,
      aboveOptionName: null,
      reason:
        breakEvenValue !== null && Number.isFinite(breakEvenValue)
          ? `The break-even value (${breakEvenValue.toFixed(1)} ${unit}) falls outside a realistic range for this variable, so it isn't a practical threshold.`
          : "This variable's effect is too small relative to the gap between options for a break-even to exist within a realistic range.",
      method: "none",
    };
  } else {
    // diffFn's sign convention is fixed regardless of which side is varying:
    // negative => best option wins, positive => runner-up wins (see buildDiffFn).
    // Determine which side of the break-even point is negative vs positive.
    const step = breakEvenValue !== 0 ? Math.abs(breakEvenValue) * 0.001 : 0.001;
    const diffAtBreakEven = diffFn(breakEvenValue);
    const slopeSign = Math.sign(diffFn(breakEvenValue + step) - diffAtBreakEven);
    const belowWinner = slopeSign > 0 ? ctx.bestOption.id : ctx.runnerUpOption.id;
    const aboveWinner = slopeSign > 0 ? ctx.runnerUpOption.id : ctx.bestOption.id;
    breakEven = {
      solvable: true,
      value: breakEvenValue,
      unit,
      belowOptionId: belowWinner,
      belowOptionName: (belowWinner === ctx.bestOption.id ? ctx.bestOption : ctx.runnerUpOption).name,
      aboveOptionId: aboveWinner,
      aboveOptionName: (aboveWinner === ctx.bestOption.id ? ctx.bestOption : ctx.runnerUpOption).name,
      reason: `Modeled threshold — the point at which the two options' calculated impacts are equal, all else held constant.`,
      method,
    };
  }

  return {
    key: `${option.id}:${kind}`,
    optionId: option.id,
    optionName: option.name,
    kind,
    label: `${option.name}'s ${VARIABLE_DISPLAY_NAME[kind]}`,
    axisLabel: axisLabel(kind, option.name),
    unit,
    currentValue,
    lowValue: low,
    highValue: high,
    diffAtCurrent,
    diffAtLow,
    diffAtHigh,
    swing,
    recommendationAtLow,
    recommendationAtHigh,
    recommendationFlipsInRange: recommendationAtLow !== recommendationAtHigh,
    breakEven,
    assumptionNote: HEURISTIC_NOTE,
  };
}

function probeRange(current: number, min: number, max: number): [number, number] {
  if (current <= 0) return [min, Math.min(max, min + (max - min) * 0.2)];
  const low = Math.max(min, current * (1 - SENSITIVITY_VARIATION_PCT / 100));
  const high = Math.min(max, current * (1 + SENSITIVITY_VARIATION_PCT / 100));
  return [low, high];
}

function buildMassVariable(ctx: VaryContext, side: "best" | "runnerUp"): SensitivityVariableResult {
  const option = side === "best" ? ctx.bestOption : ctx.runnerUpOption;
  const [low, high] = probeRange(option.massGrams, 0.1, option.massGrams * 5 || 1000);
  return buildContinuousVariable(
    ctx,
    side,
    "mass",
    option.massGrams,
    low,
    high,
    "g",
    (x) => ({ massGrams: x }),
    { min: 0.01, max: 100000 },
    "analytical",
  );
}

function buildTransportDistanceVariable(
  ctx: VaryContext,
  side: "best" | "runnerUp",
): SensitivityVariableResult {
  const option = side === "best" ? ctx.bestOption : ctx.runnerUpOption;
  const current = option.transportDistanceKm ?? 0;
  const [low, high] = probeRange(current, 0, Math.max(current * 5, 1000));
  return buildContinuousVariable(
    ctx,
    side,
    "transportDistance",
    current,
    low,
    high,
    "km",
    (x) => ({ transportDistanceKm: x }),
    { min: 0, max: 1_000_000 },
    "analytical",
  );
}

function buildRecycledContentVariable(
  ctx: VaryContext,
  side: "best" | "runnerUp",
): SensitivityVariableResult | null {
  const option = side === "best" ? ctx.bestOption : ctx.runnerUpOption;
  const material = getMaterial(option.materialCode);
  if (!material.recycledFactorId) return null;
  const current = option.recycledContentPct;
  const [low, high] = probeRange(current, 0, 100);
  return buildContinuousVariable(
    ctx,
    side,
    "recycledContent",
    current,
    low,
    high,
    "%",
    (x) => ({ recycledContentPct: x }),
    { min: 0, max: 100 },
    "analytical",
  );
}

function buildReusableMaxCyclesVariable(
  ctx: VaryContext,
  side: "best" | "runnerUp",
): SensitivityVariableResult | null {
  const option = side === "best" ? ctx.bestOption : ctx.runnerUpOption;
  if (!option.reusable || !option.reusableSettings) return null;
  const current = option.reusableSettings.maxCycles;
  const [lowRaw, high] = probeRange(current, 1, current * 5 || 5000);
  const low = Math.max(1, Math.round(lowRaw));
  return buildContinuousVariable(
    ctx,
    side,
    "reusableMaxCycles",
    current,
    low,
    Math.round(high),
    "cycles",
    (x) => ({
      reusableSettings: { ...option.reusableSettings!, maxCycles: Math.max(1, Math.round(x)) },
    }),
    { min: 1, max: 100000 },
    "numerical",
  );
}

function buildReusableLossRateVariable(
  ctx: VaryContext,
  side: "best" | "runnerUp",
): SensitivityVariableResult | null {
  const option = side === "best" ? ctx.bestOption : ctx.runnerUpOption;
  if (!option.reusable || !option.reusableSettings) return null;
  const current = option.reusableSettings.lossRatePct;
  const [low, highRaw] =
    current <= 0 ? [0, 2] : probeRange(current, 0, 99.9);
  const high = Math.min(99.9, highRaw);
  return buildContinuousVariable(
    ctx,
    side,
    "reusableLossRate",
    current,
    low,
    high,
    "%",
    (x) => ({
      reusableSettings: { ...option.reusableSettings!, lossRatePct: Math.min(99.9, Math.max(0, x)) },
    }),
    { min: 0, max: 99.9 },
    "numerical",
  );
}

function buildDisposalPathwayVariable(
  ctx: VaryContext,
  side: "best" | "runnerUp",
): SensitivityVariableResult | null {
  const option = side === "best" ? ctx.bestOption : ctx.runnerUpOption;
  const otherCentral = side === "best" ? ctx.runnerUpCentral : ctx.bestCentral;
  const pathways = getDisposalOptionsFor(option.materialCode);
  if (pathways.length < 2) return null;

  const impacts = pathways.map((p) => ({
    pathway: p.pathway,
    label: p.label,
    totalImpact: centralImpactOf({ ...option, disposalPathway: p.pathway }),
    isCurrent: p.pathway === option.disposalPathway,
  }));

  const impactValues = impacts.map((i) => i.totalImpact);
  const swing = Math.max(...impactValues) - Math.min(...impactValues);

  const diffs = impacts.map((i) =>
    side === "best" ? i.totalImpact - otherCentral : otherCentral - i.totalImpact,
  );
  const diffAtCurrentIndex = impacts.findIndex((i) => i.isCurrent);
  const lowIdx = diffs.indexOf(Math.min(...diffs));
  const highIdx = diffs.indexOf(Math.max(...diffs));

  return {
    key: `${option.id}:disposalPathway`,
    optionId: option.id,
    optionName: option.name,
    kind: "disposalPathway",
    label: `${option.name}'s ${VARIABLE_DISPLAY_NAME.disposalPathway}`,
    axisLabel: axisLabel("disposalPathway", option.name),
    unit: "",
    currentValue: diffAtCurrentIndex,
    lowValue: null,
    highValue: null,
    diffAtCurrent: ctx.bestCentral - ctx.runnerUpCentral,
    diffAtLow: diffs[lowIdx],
    diffAtHigh: diffs[highIdx],
    swing,
    recommendationAtLow: winnerAt(diffs[lowIdx], ctx.bestOption.id, ctx.runnerUpOption.id),
    recommendationAtHigh: winnerAt(diffs[highIdx], ctx.bestOption.id, ctx.runnerUpOption.id),
    recommendationFlipsInRange:
      winnerAt(diffs[lowIdx], ctx.bestOption.id, ctx.runnerUpOption.id) !==
      winnerAt(diffs[highIdx], ctx.bestOption.id, ctx.runnerUpOption.id),
    breakEven: {
      solvable: false,
      value: null,
      unit: "",
      belowOptionId: null,
      belowOptionName: null,
      aboveOptionId: null,
      aboveOptionName: null,
      reason:
        "Disposal pathway is a discrete choice, not a continuous variable — there is no break-even " +
        "threshold. Compare each available pathway's modeled impact directly instead.",
      method: "none",
    },
    assumptionNote: "Each pathway uses its own directly sourced disposal factor — not a probed range.",
    categoricalOptions: impacts,
  };
}

/**
 * Computes "what would change my decision" sensitivity for a decision's two
 * closest-competing options (the current best and its runner-up). Returns
 * null if fewer than two options can be calculated.
 */
export function computeDecisionSensitivity(decision: Decision): DecisionSensitivityResult | null {
  const scored = decision.options
    .map((option) => {
      try {
        return { option, central: centralImpactOf(option) };
      } catch {
        return null;
      }
    })
    .filter((s): s is { option: PackagingOptionDraft; central: number } => s !== null)
    .sort((a, b) => a.central - b.central);

  if (scored.length < 2) return null;

  const [bestScored, runnerUpScored] = scored;
  const ctx: VaryContext = {
    bestOption: bestScored.option,
    runnerUpOption: runnerUpScored.option,
    bestCentral: bestScored.central,
    runnerUpCentral: runnerUpScored.central,
  };

  const variables: SensitivityVariableResult[] = [];
  for (const side of ["best", "runnerUp"] as const) {
    variables.push(buildMassVariable(ctx, side));
    variables.push(buildTransportDistanceVariable(ctx, side));
    const recycled = buildRecycledContentVariable(ctx, side);
    if (recycled) variables.push(recycled);
    const disposal = buildDisposalPathwayVariable(ctx, side);
    if (disposal) variables.push(disposal);
    const maxCycles = buildReusableMaxCyclesVariable(ctx, side);
    if (maxCycles) variables.push(maxCycles);
    const lossRate = buildReusableLossRateVariable(ctx, side);
    if (lossRate) variables.push(lossRate);
  }

  variables.sort((a, b) => b.swing - a.swing);
  const mostSensitiveVariable = variables[0] ?? null;

  const insightStatement = mostSensitiveVariable
    ? `Your decision is most sensitive to ${mostSensitiveVariable.label}.`
    : "Not enough data to determine sensitivity.";

  return {
    bestOptionId: ctx.bestOption.id,
    bestOptionName: ctx.bestOption.name,
    runnerUpOptionId: ctx.runnerUpOption.id,
    runnerUpOptionName: ctx.runnerUpOption.name,
    variables,
    mostSensitiveVariable,
    insightStatement,
  };
}
