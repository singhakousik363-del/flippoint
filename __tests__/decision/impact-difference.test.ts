import { describe, expect, it } from "vitest";
import { computeImpactDifference } from "@/lib/decision/impact-difference";
import { computeDecisionResults } from "@/lib/decision/compute";
import { makeDecision, makeOption } from "./fixtures";

describe("computeImpactDifference", () => {
  it("returns null when there are fewer than two calculable options", () => {
    const decision = makeDecision([makeOption({ massGrams: 10, transportDistanceKm: 100 })]);
    const results = computeDecisionResults(decision);
    expect(computeImpactDifference(results)).toBeNull();
  });

  it("returns null when only one option is calculable and the other errored", () => {
    const ok = makeOption({ id: "ok", massGrams: 10, transportDistanceKm: 100 });
    const broken = makeOption({ id: "broken", massGrams: 10, transportDistanceKm: null });
    const results = computeDecisionResults(makeDecision([ok, broken]));
    expect(results.options.find((o) => o.optionId === "broken")!.error).not.toBeNull();
    expect(computeImpactDifference(results)).toBeNull();
  });

  it("identifies the best option and its closest calculable runner-up", () => {
    const light = makeOption({ id: "light", name: "Light", massGrams: 10, transportDistanceKm: 100 });
    const heavy = makeOption({ id: "heavy", name: "Heavy", massGrams: 40, transportDistanceKm: 100 });
    const results = computeDecisionResults(makeDecision([heavy, light]));
    const diff = computeImpactDifference(results)!;

    expect(diff).not.toBeNull();
    expect(diff.bestOptionId).toBe(results.bestOptionId);
    expect(diff.bestOptionId).toBe("light");
    expect(diff.runnerUpOptionId).toBe("heavy");
    expect(diff.bestOptionName).toBe("Light");
    expect(diff.runnerUpOptionName).toBe("Heavy");
  });

  it("computes per-unit and annual differences directly from the already-computed results", () => {
    const light = makeOption({ id: "light", name: "Light", massGrams: 10, transportDistanceKm: 100 });
    const heavy = makeOption({ id: "heavy", name: "Heavy", massGrams: 40, transportDistanceKm: 100 });
    const results = computeDecisionResults(makeDecision([heavy, light]));
    const diff = computeImpactDifference(results)!;

    const best = results.options.find((o) => o.optionId === diff.bestOptionId)!;
    const runnerUp = results.options.find((o) => o.optionId === diff.runnerUpOptionId)!;

    expect(diff.perUnitDifference).toBeCloseTo(
      runnerUp.perUnitImpact.central - best.perUnitImpact.central,
      10,
    );
    expect(diff.annualDifference).toBeCloseTo(runnerUp.annualImpact.central - best.annualImpact.central, 10);
    expect(diff.perUnitDifference).toBeGreaterThan(0);
    expect(diff.annualDifference).toBeGreaterThan(0);
  });

  it("skips errored options when selecting the runner-up", () => {
    const best = makeOption({ id: "best", name: "Best", massGrams: 10, transportDistanceKm: 100 });
    const brokenRunnerUp = makeOption({ id: "broken", name: "Broken", massGrams: 11, transportDistanceKm: null });
    const validRunnerUp = makeOption({ id: "valid", name: "Valid", massGrams: 20, transportDistanceKm: 100 });
    const results = computeDecisionResults(makeDecision([best, brokenRunnerUp, validRunnerUp]));

    const diff = computeImpactDifference(results)!;
    expect(diff.bestOptionId).toBe("best");
    expect(diff.runnerUpOptionId).toBe("valid");
  });

  it("returns a zero difference when the best and runner-up have equal impact", () => {
    const a = makeOption({ id: "a", name: "A", massGrams: 10, transportDistanceKm: 100 });
    const b = makeOption({ id: "b", name: "B", massGrams: 10, transportDistanceKm: 100 });
    const results = computeDecisionResults(makeDecision([a, b]));
    const diff = computeImpactDifference(results)!;

    expect(diff.perUnitDifference).toBeCloseTo(0, 10);
    expect(diff.annualDifference).toBeCloseTo(0, 10);
  });
});
