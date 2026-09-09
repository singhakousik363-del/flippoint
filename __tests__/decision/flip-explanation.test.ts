import { describe, expect, it } from "vitest";
import { buildFlipExplanation, computeChangedFields, formatThresholdValue } from "@/lib/decision/flip-explanation";
import { computeDecisionSensitivity } from "@/lib/decision/sensitivity";
import { compareWhatIf } from "@/lib/decision/what-if";
import { makeDecision, makeOption, makeReusableSettings } from "./fixtures";

describe("computeChangedFields", () => {
  const option = makeOption({ massGrams: 10, transportDistanceKm: 100, recycledContentPct: 20 });

  it("returns an empty array when nothing changed", () => {
    const changed = computeChangedFields(
      option,
      {
        massGrams: option.massGrams,
        transportDistanceKm: option.transportDistanceKm ?? 0,
        recycledContentPct: option.recycledContentPct,
        reusableSettings: null,
      },
      { supportsRecycledContent: true, isReusable: false },
    );
    expect(changed).toEqual([]);
  });

  it("detects a changed item mass", () => {
    const changed = computeChangedFields(
      option,
      { massGrams: 50, transportDistanceKm: 100, recycledContentPct: 20, reusableSettings: null },
      { supportsRecycledContent: true, isReusable: false },
    );
    expect(changed).toEqual([{ label: "Item mass", from: "10.0 g", to: "50.0 g" }]);
  });

  it("detects a changed transport distance", () => {
    const changed = computeChangedFields(
      option,
      { massGrams: 10, transportDistanceKm: 400, recycledContentPct: 20, reusableSettings: null },
      { supportsRecycledContent: true, isReusable: false },
    );
    expect(changed).toEqual([{ label: "Transport distance", from: "100 km", to: "400 km" }]);
  });

  it("ignores recycled content changes when the material doesn't support it", () => {
    const changed = computeChangedFields(
      option,
      { massGrams: 10, transportDistanceKm: 100, recycledContentPct: 90, reusableSettings: null },
      { supportsRecycledContent: false, isReusable: false },
    );
    expect(changed).toEqual([]);
  });

  it("detects recycled content changes when supported", () => {
    const changed = computeChangedFields(
      option,
      { massGrams: 10, transportDistanceKm: 100, recycledContentPct: 90, reusableSettings: null },
      { supportsRecycledContent: true, isReusable: false },
    );
    expect(changed).toEqual([{ label: "Recycled content", from: "20%", to: "90%" }]);
  });

  it("detects reusable settings changes only when the option is reusable", () => {
    const reusable = makeOption({
      massGrams: 10,
      transportDistanceKm: 100,
      reusable: true,
      reusableSettings: makeReusableSettings({ maxCycles: 500, lossRatePct: 2 }),
    });
    const scenario = {
      massGrams: 10,
      transportDistanceKm: 100,
      recycledContentPct: reusable.recycledContentPct,
      reusableSettings: makeReusableSettings({ maxCycles: 800, lossRatePct: 5 }),
    };

    expect(computeChangedFields(reusable, scenario, { supportsRecycledContent: false, isReusable: false })).toEqual(
      [],
    );

    expect(computeChangedFields(reusable, scenario, { supportsRecycledContent: false, isReusable: true })).toEqual([
      { label: "Rated reuse cycles", from: "500", to: "800" },
      { label: "Loss rate per cycle", from: "2.0%", to: "5.0%" },
    ]);
  });
});

describe("buildFlipExplanation", () => {
  it("returns null when the comparison does not flip", () => {
    const a = makeOption({ id: "a", name: "A", massGrams: 10, transportDistanceKm: 100 });
    const b = makeOption({ id: "b", name: "B", massGrams: 40, transportDistanceKm: 100 });
    const decision = makeDecision([a, b]);
    const comparison = compareWhatIf(decision, "a", { massGrams: 10.1 });
    const changedFields = computeChangedFields(
      a,
      { massGrams: 10.1, transportDistanceKm: 100, recycledContentPct: 0, reusableSettings: null },
      { supportsRecycledContent: false, isReusable: false },
    );
    expect(buildFlipExplanation(comparison, changedFields, null)).toBeNull();
  });

  it("reports the previous winner, new winner, primary variable, and threshold when solvable", () => {
    const a = makeOption({ id: "a", name: "A", massGrams: 10, transportDistanceKm: 100 });
    const b = makeOption({ id: "b", name: "B", massGrams: 12, transportDistanceKm: 100 });
    const decision = makeDecision([a, b]);

    const comparison = compareWhatIf(decision, "a", { massGrams: 200 });
    expect(comparison.flips).toBe(true);
    expect(comparison.currentBestOptionId).toBe("a");
    expect(comparison.scenarioBestOptionId).toBe("b");

    const changedFields = computeChangedFields(
      a,
      { massGrams: 200, transportDistanceKm: 100, recycledContentPct: 0, reusableSettings: null },
      { supportsRecycledContent: false, isReusable: false },
    );

    const sensitivity = computeDecisionSensitivity(decision)!;
    const massThreshold = sensitivity.variables.find((v) => v.optionId === "a" && v.kind === "mass")!;
    expect(massThreshold.breakEven.solvable).toBe(true);

    const explanation = buildFlipExplanation(comparison, changedFields, massThreshold);

    expect(explanation).not.toBeNull();
    expect(explanation!.previousWinnerName).toBe("A");
    expect(explanation!.newWinnerName).toBe("B");
    expect(explanation!.primaryVariableLabel).toBe("Item mass");
    expect(explanation!.previousValue).toBe("10.0 g");
    expect(explanation!.scenarioValue).toBe("200.0 g");
    expect(explanation!.threshold).not.toBeNull();
    expect(explanation!.threshold!.formatted).toBe(
      formatThresholdValue(massThreshold.breakEven.value!, massThreshold.unit),
    );
    expect(explanation!.sentence).toContain("A");
    expect(explanation!.sentence).toContain("B");
    expect(explanation!.sentence).toContain("item mass");
    expect(explanation!.sentence).toContain(explanation!.threshold!.formatted);
  });

  it("omits the threshold clause when no threshold is available", () => {
    const a = makeOption({ id: "a", name: "A", massGrams: 10, transportDistanceKm: 100 });
    const b = makeOption({ id: "b", name: "B", massGrams: 12, transportDistanceKm: 100 });
    const decision = makeDecision([a, b]);
    const comparison = compareWhatIf(decision, "a", { massGrams: 200 });
    const changedFields = computeChangedFields(
      a,
      { massGrams: 200, transportDistanceKm: 100, recycledContentPct: 0, reusableSettings: null },
      { supportsRecycledContent: false, isReusable: false },
    );

    const explanation = buildFlipExplanation(comparison, changedFields, null);

    expect(explanation).not.toBeNull();
    expect(explanation!.threshold).toBeNull();
    expect(explanation!.sentence).not.toContain("break-even");
  });

  it("treats an unsolvable break-even the same as a missing threshold", () => {
    const a = makeOption({ id: "a", name: "A", massGrams: 10, transportDistanceKm: 100 });
    const b = makeOption({ id: "b", name: "B", massGrams: 12, transportDistanceKm: 100 });
    const decision = makeDecision([a, b]);
    const comparison = compareWhatIf(decision, "a", { massGrams: 200 });
    const changedFields = computeChangedFields(
      a,
      { massGrams: 200, transportDistanceKm: 100, recycledContentPct: 0, reusableSettings: null },
      { supportsRecycledContent: false, isReusable: false },
    );

    const sensitivity = computeDecisionSensitivity(decision)!;
    const massThreshold = sensitivity.variables.find((v) => v.optionId === "a" && v.kind === "mass")!;
    const unsolvable = {
      ...massThreshold,
      breakEven: { ...massThreshold.breakEven, solvable: false, value: null },
    };

    const explanation = buildFlipExplanation(comparison, changedFields, unsolvable);

    expect(explanation).not.toBeNull();
    expect(explanation!.threshold).toBeNull();
    expect(explanation!.sentence).not.toContain("break-even");
  });

  it("falls back to a generic sentence when nothing was tracked as changed", () => {
    const a = makeOption({ id: "a", name: "A", massGrams: 10, transportDistanceKm: 100 });
    const b = makeOption({ id: "b", name: "B", massGrams: 12, transportDistanceKm: 100 });
    const decision = makeDecision([a, b]);
    const comparison = compareWhatIf(decision, "a", { massGrams: 200 });

    const explanation = buildFlipExplanation(comparison, [], null);

    expect(explanation).not.toBeNull();
    expect(explanation!.primaryVariableLabel).toBeNull();
    expect(explanation!.previousValue).toBeNull();
    expect(explanation!.scenarioValue).toBeNull();
    expect(explanation!.sentence).toContain("A");
    expect(explanation!.sentence).toContain("B");
  });
});
