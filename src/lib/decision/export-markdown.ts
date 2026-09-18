import { getMaterial, TRANSPORT_CATALOG } from "@/lib/data/catalog";
import { formatKgCo2e, formatUses } from "@/lib/format";
import { SENSITIVITY_VARIATION_PCT } from "@/lib/decision/sensitivity";
import type { DecisionResults, OptionResult } from "@/lib/decision/compute";
import type { DecisionSensitivityResult, SensitivityVariableResult } from "@/lib/decision/sensitivity";
import type { Decision, PackagingOptionDraft } from "@/types/decision";
import type { EmissionFactor } from "@/types/domain";

const SCOPE_LINE =
  "FlipPoint produces modeled decision-support estimates, not a certified Life Cycle Assessment (LCA).";

function heading(level: number, text: string): string {
  return `${"#".repeat(level)} ${text}`;
}

function bullet(label: string, value: string): string {
  return `- **${label}:** ${value}`;
}

function formatPercent(pct: number): string {
  return `${pct.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

function formatGeneratedDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function transportModeLabel(transportFactorId: string): string {
  return TRANSPORT_CATALOG.find((t) => t.factorId === transportFactorId)?.label ?? transportFactorId;
}

function impactLine(label: string, impact: { central: number; low?: number; high?: number; confidence: string }): string {
  const range =
    impact.low !== undefined && impact.high !== undefined
      ? ` (range: ${formatKgCo2e(impact.low)} - ${formatKgCo2e(impact.high)})`
      : "";
  return bullet(label, `${formatKgCo2e(impact.central)}${range} — ${impact.confidence} confidence`);
}

function renderOptionInputs(option: PackagingOptionDraft): string[] {
  const material = getMaterial(option.materialCode);
  const lines: string[] = [
    bullet("Material", material.label),
    bullet("Mass", `${option.massGrams.toLocaleString()} g`),
    bullet("Recycled content", formatPercent(option.recycledContentPct)),
    bullet(
      "Transport",
      `${option.transportDistanceKm !== null ? `${option.transportDistanceKm.toLocaleString()} km` : "not set"} via ${transportModeLabel(option.transportFactorId)}`,
    ),
    bullet("Disposal pathway", capitalize(option.disposalPathway)),
    bullet("Reusable", option.reusable ? "Yes" : "No"),
  ];
  if (option.reusable && option.reusableSettings) {
    const s = option.reusableSettings;
    lines.push(
      bullet("Rated max cycles", s.maxCycles.toLocaleString()),
      bullet("Loss rate per cycle", formatPercent(s.lossRatePct)),
      bullet("Items per wash", s.itemsPerWash.toLocaleString()),
      bullet("Return transport per use", `${formatKgCo2e(s.returnTransportPerUseKgCo2e)}`),
    );
  }
  return lines;
}

function renderOptionResults(result: OptionResult): string[] {
  const lines: string[] = [];
  if (result.error) {
    lines.push(bullet("Calculation error", result.error));
    return lines;
  }

  lines.push(impactLine(result.isReusable ? "Per use (calculated)" : "Per unit (calculated)", result.perUnitImpact));
  lines.push(impactLine("Annual (calculated)", result.annualImpact));

  if (result.singleUse) {
    lines.push("", heading(4, "Lifecycle breakdown"));
    lines.push(impactLine("Production", result.singleUse.production));
    lines.push(impactLine("Transport", result.singleUse.transport));
    lines.push(impactLine("Disposal", result.singleUse.disposal));
    if (result.singleUse.flags.recycledContentInterpolated) {
      lines.push(bullet("Note", "Recycled-content impact is interpolated between virgin and 100%-recycled factors."));
    }
    if (result.singleUse.flags.defaultTransportAssumption) {
      lines.push(bullet("Note", "Transport distance used a default assumption, not a user-supplied value."));
    }
  }

  if (result.reusable) {
    const r = result.reusable;
    lines.push("", heading(4, "Lifecycle breakdown"));
    lines.push(bullet("Initial production + transport", formatKgCo2e(r.fixed.production + r.fixed.transportInitial)));
    lines.push(bullet("End-of-life (at retirement)", formatKgCo2e(r.fixed.endOfLife)));
    lines.push(bullet("Washing, per use", formatKgCo2e(r.recurring.washingPerUse)));
    lines.push(bullet("Return transport, per use", formatKgCo2e(r.recurring.returnTransportPerUse)));
    lines.push(bullet("Expected effective lifetime", `${formatUses(r.effectiveCycles)} uses`));
    if (r.breakEvenVsLowestSingleUse) {
      const be = r.breakEvenVsLowestSingleUse;
      const beText = be.reachable
        ? `Break-even at ${formatUses(be.breakEvenUses)} uses vs. "${be.comparatorOptionName}"`
        : `No break-even vs. "${be.comparatorOptionName}" under current assumptions — ${be.reason}`;
      lines.push(bullet("Break-even", beText));
      if (r.feasibility) {
        lines.push(bullet("Feasibility", r.feasibility.note));
      }
    }
  }

  return lines;
}

function renderBreakEven(v: SensitivityVariableResult): string {
  if (!v.breakEven.solvable) return "";
  const be = v.breakEven;
  const core =
    `  - Break-even: ${be.value!.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${be.unit}` +
    ` — below this, "${be.belowOptionName}" wins; above it, "${be.aboveOptionName}" wins.`;
  // Mirrors the workspace's own "Stable" vs "Decision-sensitive" judgement
  // (VariableCard's badge), which is driven by this same flag — a
  // mathematically solvable break-even can still sit outside the +/-20%
  // range actually probed around the current inputs.
  if (!v.recommendationFlipsInRange) {
    return `${core} Marked "Stable" in the workspace — this break-even falls outside the +/-${SENSITIVITY_VARIATION_PCT}% range probed around your current inputs, so it isn't a practical near-term threshold.`;
  }
  return core;
}

function renderSensitivity(sensitivity: DecisionSensitivityResult | null): string[] {
  if (!sensitivity) {
    return ["Sensitivity analysis needs at least two calculable options; not available for this decision."];
  }
  const lines: string[] = [
    `Comparing best option **${sensitivity.bestOptionName}** against runner-up **${sensitivity.runnerUpOptionName}**.`,
    "",
    sensitivity.insightStatement,
    "",
    heading(3, "Ranking (most to least sensitive)"),
  ];
  sensitivity.variables.forEach((v, i) => {
    lines.push(`${i + 1}. ${v.label} — swing: ${formatKgCo2e(v.swing)}${v.recommendationFlipsInRange ? " (can flip the recommendation)" : ""}`);
    const beLine = renderBreakEven(v);
    if (beLine) lines.push(beLine);
  });
  return lines;
}

function renderFactor(f: EmissionFactor): string[] {
  return [
    heading(4, `${f.material} — ${f.category}${f.subCategory ? ` (${f.subCategory})` : ""}`),
    bullet("Value", `${f.value.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${f.unit}`),
    bullet("Source", f.source.name),
    bullet("Publication year", String(f.source.publicationYear)),
    bullet("URL", f.source.url),
    bullet("Calculation basis", f.calculationBasis),
  ];
}

function collectFactors(results: DecisionResults): EmissionFactor[] {
  const byId = new Map<string, EmissionFactor>();
  for (const option of results.options) {
    for (const factor of option.factorsUsed) {
      byId.set(factor.id, factor);
    }
  }
  return Array.from(byId.values());
}

/**
 * Renders a decision's already-computed results as a Markdown decision
 * record. Reads only values already present on `decision`, `results`, and
 * `sensitivity` — performs no calculation of its own.
 */
export function buildDecisionRecordMarkdown(
  decision: Decision,
  results: DecisionResults,
  sensitivity: DecisionSensitivityResult | null,
): string {
  const lines: string[] = [];

  lines.push(heading(1, `Decision record: ${decision.name}`), "");
  lines.push(bullet("Business context", decision.businessContext || "Not specified"));
  lines.push(bullet("Annual volume", `${decision.annualVolume.toLocaleString()} units/year`));
  lines.push(bullet("Generated on", formatGeneratedDate(new Date())));
  lines.push("");

  const best = results.options.find((o) => o.optionId === results.bestOptionId) ?? null;
  lines.push(heading(2, "Recommendation"));
  if (best) {
    lines.push(bullet("Recommended option", best.optionName));
    lines.push(impactLine(best.isReusable ? "Per use" : "Per unit", best.perUnitImpact));
    lines.push(impactLine("Annual", best.annualImpact));
  } else {
    lines.push("No recommendation could be computed for this decision.");
  }

  const valid = results.options.filter((o) => !o.error);
  const runnerUp =
    best &&
    valid
      .filter((o) => o.optionId !== best.optionId)
      .reduce<OptionResult | null>(
        (closest, o) => (!closest || o.perUnitImpact.central < closest.perUnitImpact.central ? o : closest),
        null,
      );
  if (best && runnerUp) {
    const perUnitGap = runnerUp.perUnitImpact.central - best.perUnitImpact.central;
    const annualGap = runnerUp.annualImpact.central - best.annualImpact.central;
    lines.push(
      bullet(
        "Gap to runner-up",
        `${formatKgCo2e(perUnitGap)} less per ${best.isReusable ? "use" : "unit"} and ${formatKgCo2e(annualGap)} less annually than "${runnerUp.optionName}"`,
      ),
    );
  }
  lines.push("");

  lines.push(heading(2, "Options"));
  for (const option of decision.options) {
    const result = results.options.find((o) => o.optionId === option.id);
    lines.push(heading(3, `${option.name}${option.id === results.bestOptionId ? " (Recommended)" : ""}`));
    lines.push(...renderOptionInputs(option));
    lines.push("");
    if (result) {
      lines.push(...renderOptionResults(result));
    }
    lines.push("");
  }

  lines.push(heading(2, "Sensitivity analysis"));
  lines.push(...renderSensitivity(sensitivity));
  lines.push("");

  lines.push(heading(2, "Emission factors used"));
  const factors = collectFactors(results);
  if (factors.length === 0) {
    lines.push("No emission factors were used in this decision's calculations.");
  } else {
    for (const factor of factors) {
      lines.push(...renderFactor(factor), "");
    }
  }

  lines.push(heading(2, "Scope"));
  lines.push(SCOPE_LINE);

  return lines.join("\n");
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "decision";
}

export function buildDecisionRecordFilename(decision: Decision): string {
  return `${slugify(decision.name)}-decision-record.md`;
}
