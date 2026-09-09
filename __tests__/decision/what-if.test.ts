import { describe, expect, it } from "vitest";
import { buildScenarioDecision, compareWhatIf } from "@/lib/decision/what-if";
import { computeDecisionResults } from "@/lib/decision/compute";
import { makeDecision, makeOption, makeReusableSettings } from "./fixtures";

describe("buildScenarioDecision", () => {
  it("patches only the target option", () => {
    const a = makeOption({ id: "a", massGrams: 12 });
    const b = makeOption({ id: "b", massGrams: 20 });
    const decision = makeDecision([a, b]);
    const scenario = buildScenarioDecision(decision, "a", { massGrams: 999 });
    expect(scenario.options.find((o) => o.id === "a")!.massGrams).toBe(999);
    expect(scenario.options.find((o) => o.id === "b")!.massGrams).toBe(20);
  });

  it("does not mutate the original decision", () => {
    const a = makeOption({ id: "a", massGrams: 12 });
    const decision = makeDecision([a, makeOption({ id: "b" })]);
    buildScenarioDecision(decision, "a", { massGrams: 999 });
    expect(decision.options.find((o) => o.id === "a")!.massGrams).toBe(12);
  });

  it("is a no-op when the target optionId doesn't exist", () => {
    const decision = makeDecision([makeOption({ id: "a" }), makeOption({ id: "b" })]);
    const scenario = buildScenarioDecision(decision, "nonexistent", { massGrams: 999 });
    expect(scenario.options).toEqual(decision.options);
  });
});

describe("compareWhatIf", () => {
  it("reports flips=false when the patch is too small to change the winner", () => {
    const a = makeOption({ id: "a", massGrams: 10, transportDistanceKm: 100 });
    const b = makeOption({ id: "b", massGrams: 40, transportDistanceKm: 100 });
    const decision = makeDecision([a, b]);
    const comparison = compareWhatIf(decision, "a", { massGrams: 10.1 });
    expect(comparison.flips).toBe(false);
    expect(comparison.currentBestOptionId).toBe(comparison.scenarioBestOptionId);
  });

  it("detects a flip when the patch is large enough to change the winner", () => {
    const a = makeOption({ id: "a", massGrams: 10, transportDistanceKm: 100 });
    const b = makeOption({ id: "b", massGrams: 12, transportDistanceKm: 100 });
    const decision = makeDecision([a, b]);
    // 'a' currently wins (lighter); pushing its mass far above 'b' should flip the winner to 'b'.
    const comparison = compareWhatIf(decision, "a", { massGrams: 200 });
    expect(comparison.currentBestOptionId).toBe("a");
    expect(comparison.scenarioBestOptionId).toBe("b");
    expect(comparison.flips).toBe(true);
  });

  it("computes deltaPerUnitImpact with the correct sign (heavier => higher impact)", () => {
    const a = makeOption({ id: "a", massGrams: 10 });
    const b = makeOption({ id: "b", massGrams: 500 }); // keep 'a' the winner in both scenarios
    const decision = makeDecision([a, b]);
    const comparison = compareWhatIf(decision, "a", { massGrams: 20 });
    expect(comparison.deltaPerUnitImpact).toBeGreaterThan(0);
  });

  it("matches computeDecisionResults exactly for both the current and scenario states", () => {
    const a = makeOption({ id: "a", massGrams: 12 });
    const b = makeOption({ id: "b", massGrams: 20 });
    const decision = makeDecision([a, b]);
    const comparison = compareWhatIf(decision, "a", { massGrams: 15 });
    const directCurrent = computeDecisionResults(decision);
    const directScenario = computeDecisionResults(buildScenarioDecision(decision, "a", { massGrams: 15 }));
    expect(comparison.currentResults.bestOptionId).toBe(directCurrent.bestOptionId);
    expect(comparison.scenarioResults.bestOptionId).toBe(directScenario.bestOptionId);
  });

  it("recomputes a reusable option's per-use impact when reusable settings are patched", () => {
    const reusable = makeOption({
      id: "r",
      materialCode: "PP",
      massGrams: 50,
      reusable: true,
      reusableSettings: makeReusableSettings({ maxCycles: 500, lossRatePct: 2 }),
    });
    const singleUse = makeOption({ id: "s", massGrams: 12 });
    const decision = makeDecision([reusable, singleUse]);
    const comparison = compareWhatIf(decision, "r", {
      reusableSettings: makeReusableSettings({ maxCycles: 500, lossRatePct: 50 }), // much worse loss rate
    });
    expect(comparison.deltaPerUnitImpact).toBeGreaterThan(0);
  });

  it("handles a nonexistent optionId without crashing (zero delta, no flip)", () => {
    const decision = makeDecision([makeOption({ id: "a" }), makeOption({ id: "b", massGrams: 20 })]);
    expect(() => compareWhatIf(decision, "nonexistent", { massGrams: 5 })).not.toThrow();
    const comparison = compareWhatIf(decision, "nonexistent", { massGrams: 5 });
    expect(comparison.deltaPerUnitImpact).toBe(0);
    expect(comparison.flips).toBe(false);
  });

  it("handles a two-option decision where both options are nearly identical (near-zero denominator)", () => {
    const a = makeOption({ id: "a", massGrams: 12 });
    const b = makeOption({ id: "b", massGrams: 12.0000001 });
    const decision = makeDecision([a, b]);
    expect(() => compareWhatIf(decision, "a", { massGrams: 12.5 })).not.toThrow();
  });
});
