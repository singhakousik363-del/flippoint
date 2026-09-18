import { describe, expect, it } from "vitest";
import { computeDecisionResults } from "@/lib/decision/compute";
import { computeDecisionSensitivity } from "@/lib/decision/sensitivity";
import { buildDecisionRecordFilename, buildDecisionRecordMarkdown } from "@/lib/decision/export-markdown";
import { formatKgCo2e } from "@/lib/format";
import { makeDecision, makeOption, makeReusableSettings } from "./fixtures";

describe("buildDecisionRecordMarkdown", () => {
  it("includes decision name, business context, and annual volume", () => {
    const decision = makeDecision(
      [makeOption({ id: "a", name: "A", massGrams: 10 }), makeOption({ id: "b", name: "B", massGrams: 20 })],
      { name: "Bottle cap switch", businessContext: "Q3 packaging review", annualVolume: 12345 },
    );
    const results = computeDecisionResults(decision);
    const sensitivity = computeDecisionSensitivity(decision);
    const md = buildDecisionRecordMarkdown(decision, results, sensitivity);

    expect(md).toContain("Bottle cap switch");
    expect(md).toContain("Q3 packaging review");
    expect(md).toContain("12,345 units/year");
  });

  it("includes every option's inputs: material, mass, recycled content, transport, disposal", () => {
    const decision = makeDecision([
      makeOption({
        id: "a",
        name: "Recycled PET bottle",
        materialCode: "PET",
        massGrams: 25,
        recycledContentPct: 40,
        transportDistanceKm: 250,
        disposalPathway: "recycling",
      }),
      makeOption({ id: "b", name: "Baseline", massGrams: 30, transportDistanceKm: 250 }),
    ]);
    const results = computeDecisionResults(decision);
    const sensitivity = computeDecisionSensitivity(decision);
    const md = buildDecisionRecordMarkdown(decision, results, sensitivity);

    expect(md).toContain("Recycled PET bottle");
    expect(md).toContain("PET (polyethylene terephthalate)");
    expect(md).toContain("25 g");
    expect(md).toContain("40%");
    expect(md).toContain("250 km");
    expect(md).toContain("Recycling");
  });

  it("shows the human-readable transport mode label, not the internal factor id", () => {
    const decision = makeDecision([
      makeOption({ id: "a", name: "A", transportFactorId: "road-freight-hgv-average", transportDistanceKm: 250 }),
      makeOption({ id: "b", name: "B", massGrams: 20, transportDistanceKm: 250 }),
    ]);
    const results = computeDecisionResults(decision);
    const sensitivity = computeDecisionSensitivity(decision);
    const md = buildDecisionRecordMarkdown(decision, results, sensitivity);

    expect(md).toContain("Road freight (HGV, average laden)");
    expect(md).not.toContain("factor: road-freight-hgv-average");
  });

  it("capitalises the disposal pathway", () => {
    const decision = makeDecision([
      makeOption({ id: "a", name: "A", disposalPathway: "landfill" }),
      makeOption({ id: "b", name: "B", massGrams: 20, disposalPathway: "combustion" }),
    ]);
    const results = computeDecisionResults(decision);
    const sensitivity = computeDecisionSensitivity(decision);
    const md = buildDecisionRecordMarkdown(decision, results, sensitivity);

    expect(md).toContain("**Disposal pathway:** Landfill");
    expect(md).toContain("**Disposal pathway:** Combustion");
    expect(md).not.toContain("**Disposal pathway:** landfill");
    expect(md).not.toContain("**Disposal pathway:** combustion");
  });

  it("includes per-unit and annual impact plus the lifecycle breakdown, read from computed results", () => {
    const a = makeOption({ id: "a", name: "A", massGrams: 10, transportDistanceKm: 100 });
    const b = makeOption({ id: "b", name: "B", massGrams: 40, transportDistanceKm: 100 });
    const decision = makeDecision([a, b]);
    const results = computeDecisionResults(decision);
    const sensitivity = computeDecisionSensitivity(decision);
    const md = buildDecisionRecordMarkdown(decision, results, sensitivity);

    const resultA = results.options.find((o) => o.optionId === "a")!;
    expect(md).toContain(formatKgCo2e(resultA.perUnitImpact.central));
    expect(md).toContain(formatKgCo2e(resultA.annualImpact.central));
    expect(md).toContain(formatKgCo2e(resultA.singleUse!.production.central));
    expect(md).toContain(formatKgCo2e(resultA.singleUse!.transport.central));
    expect(md).toContain(formatKgCo2e(resultA.singleUse!.disposal.central));
  });

  it("includes the reusable lifecycle breakdown and break-even for reusable options", () => {
    const singleUse = makeOption({ id: "single", name: "Single-use", massGrams: 10, transportDistanceKm: 50 });
    const reusable = makeOption({
      id: "reusable",
      name: "Reusable tote",
      massGrams: 200,
      transportDistanceKm: 50,
      reusable: true,
      reusableSettings: makeReusableSettings({ maxCycles: 300, lossRatePct: 5 }),
    });
    const decision = makeDecision([singleUse, reusable]);
    const results = computeDecisionResults(decision);
    const sensitivity = computeDecisionSensitivity(decision);
    const md = buildDecisionRecordMarkdown(decision, results, sensitivity);

    const reusableResult = results.options.find((o) => o.optionId === "reusable")!;
    expect(reusableResult.reusable).not.toBeNull();
    expect(md).toContain(formatKgCo2e(reusableResult.reusable!.fixed.endOfLife));
    expect(md).toContain(formatKgCo2e(reusableResult.reusable!.recurring.washingPerUse));
    if (reusableResult.reusable!.breakEvenVsLowestSingleUse?.reachable) {
      expect(md).toContain("Break-even");
    }
  });

  it("includes the recommendation and the gap to the runner-up", () => {
    const light = makeOption({ id: "light", name: "Light", massGrams: 10, transportDistanceKm: 100 });
    const heavy = makeOption({ id: "heavy", name: "Heavy", massGrams: 40, transportDistanceKm: 100 });
    const decision = makeDecision([heavy, light]);
    const results = computeDecisionResults(decision);
    const sensitivity = computeDecisionSensitivity(decision);
    const md = buildDecisionRecordMarkdown(decision, results, sensitivity);

    const best = results.options.find((o) => o.optionId === results.bestOptionId)!;
    const runnerUp = results.options.find((o) => o.optionId === "heavy")!;
    const gap = runnerUp.perUnitImpact.central - best.perUnitImpact.central;

    expect(md).toContain("Recommendation");
    expect(md).toContain(best.optionName);
    expect(md).toContain(formatKgCo2e(gap));
    expect(md).toContain(runnerUp.optionName);
  });

  it("includes the sensitivity ranking and every solvable break-even", () => {
    const a = makeOption({ id: "a", name: "Option A", massGrams: 12, transportDistanceKm: 400 });
    const b = makeOption({ id: "b", name: "Option B", massGrams: 14, transportDistanceKm: 420 });
    const decision = makeDecision([a, b]);
    const results = computeDecisionResults(decision);
    const sensitivity = computeDecisionSensitivity(decision)!;
    const md = buildDecisionRecordMarkdown(decision, results, sensitivity);

    expect(md).toContain("Sensitivity analysis");
    expect(md).toContain(sensitivity.insightStatement);
    for (const v of sensitivity.variables) {
      expect(md).toContain(v.label);
      if (v.breakEven.solvable) {
        expect(md).toContain(v.breakEven.belowOptionName!);
        expect(md).toContain(v.breakEven.aboveOptionName!);
      }
    }
  });

  it("marks a solvable break-even 'Stable' exactly when the workspace would — mirroring recommendationFlipsInRange, no new rule", () => {
    // Same shape as the seeded demo scenario: a close head-to-head where the
    // recycled-content option's transport distance has a mathematically
    // solvable break-even that sits well outside the +/-20% range actually
    // probed, so the workspace's VariableCard badges it "Stable".
    const recycledContent = makeOption({
      id: "recycled",
      name: "Recycled-content PET cup",
      massGrams: 16,
      recycledContentPct: 30,
      transportDistanceKm: 200,
    });
    const lightweight = makeOption({
      id: "lightweight",
      name: "Lightweight virgin PET cup",
      massGrams: 12,
      recycledContentPct: 0,
      transportDistanceKm: 400,
    });
    const decision = makeDecision([recycledContent, lightweight], { annualVolume: 26000 });
    const results = computeDecisionResults(decision);
    const sensitivity = computeDecisionSensitivity(decision)!;
    const md = buildDecisionRecordMarkdown(decision, results, sensitivity);

    const stableSolvable = sensitivity.variables.find((v) => v.breakEven.solvable && !v.recommendationFlipsInRange);
    const flippingSolvable = sensitivity.variables.find((v) => v.breakEven.solvable && v.recommendationFlipsInRange);
    expect(stableSolvable).toBeDefined();
    expect(flippingSolvable).toBeDefined();

    const stableValueText = stableSolvable!.breakEven.value!.toLocaleString(undefined, { maximumFractionDigits: 2 });
    const stableLineMatch = md
      .split("\n")
      .find((line) => line.includes("Break-even:") && line.includes(stableValueText));
    expect(stableLineMatch).toBeDefined();
    expect(stableLineMatch).toContain('Marked "Stable" in the workspace');
    expect(stableLineMatch).toContain("isn't a practical near-term threshold");

    const flippingValueText = flippingSolvable!.breakEven.value!.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
    const flippingLineMatch = md
      .split("\n")
      .find((line) => line.includes("Break-even:") && line.includes(flippingValueText));
    expect(flippingLineMatch).toBeDefined();
    expect(flippingLineMatch).not.toContain("Stable");
  });

  it("falls back gracefully when sensitivity is unavailable", () => {
    const decision = makeDecision([makeOption({ id: "only", name: "Only option" })]);
    const results = computeDecisionResults(decision);
    const md = buildDecisionRecordMarkdown(decision, results, null);
    expect(md).toContain("Sensitivity analysis needs at least two calculable options");
  });

  it("includes every emission factor used, with source name, year, URL, and calculation basis", () => {
    const a = makeOption({ id: "a", name: "A", massGrams: 10, transportDistanceKm: 100 });
    const b = makeOption({ id: "b", name: "B", massGrams: 20, transportDistanceKm: 100 });
    const decision = makeDecision([a, b]);
    const results = computeDecisionResults(decision);
    const sensitivity = computeDecisionSensitivity(decision);
    const md = buildDecisionRecordMarkdown(decision, results, sensitivity);

    const allFactors = results.options.flatMap((o) => o.factorsUsed);
    const uniqueFactors = Array.from(new Map(allFactors.map((f) => [f.id, f])).values());
    expect(uniqueFactors.length).toBeGreaterThan(0);
    for (const factor of uniqueFactors) {
      expect(md).toContain(factor.source.name);
      expect(md).toContain(String(factor.source.publicationYear));
      expect(md).toContain(factor.source.url);
      expect(md).toContain(factor.calculationBasis);
    }
  });

  it("includes the standard scope line and a readable generated-on date", () => {
    const decision = makeDecision([makeOption({ id: "a" }), makeOption({ id: "b", massGrams: 20 })]);
    const results = computeDecisionResults(decision);
    const sensitivity = computeDecisionSensitivity(decision);
    const md = buildDecisionRecordMarkdown(decision, results, sensitivity);

    expect(md).toContain(
      "FlipPoint produces modeled decision-support estimates, not a certified Life Cycle Assessment (LCA).",
    );

    const expectedDate = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    expect(md).toContain(`**Generated on:** ${expectedDate}`);
    // Not an ISO timestamp.
    expect(md).not.toMatch(/Generated on:\*\* \d{4}-\d{2}-\d{2}T/);
  });

  it("performs no new calculation — reuses the exact central values already on the results object", () => {
    const a = makeOption({ id: "a", name: "A", massGrams: 17.345, transportDistanceKm: 133 });
    const b = makeOption({ id: "b", name: "B", massGrams: 22.1, transportDistanceKm: 87 });
    const decision = makeDecision([a, b]);
    const results = computeDecisionResults(decision);
    const sensitivity = computeDecisionSensitivity(decision);
    const md = buildDecisionRecordMarkdown(decision, results, sensitivity);

    for (const option of results.options) {
      expect(md).toContain(formatKgCo2e(option.perUnitImpact.central));
      expect(md).toContain(formatKgCo2e(option.annualImpact.central));
    }
  });
});

describe("buildDecisionRecordFilename", () => {
  it("slugifies the decision name into a .md filename", () => {
    const decision = makeDecision([makeOption()], { name: "Q3 Packaging Review!! 2026" });
    expect(buildDecisionRecordFilename(decision)).toBe("q3-packaging-review-2026-decision-record.md");
  });

  it("falls back to a generic name when the decision name has no usable characters", () => {
    const decision = makeDecision([makeOption()], { name: "!!!" });
    expect(buildDecisionRecordFilename(decision)).toBe("decision-decision-record.md");
  });
});
