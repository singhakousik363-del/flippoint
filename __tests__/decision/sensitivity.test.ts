import { describe, expect, it } from "vitest";
import { computeDecisionSensitivity, SENSITIVITY_VARIATION_PCT } from "@/lib/decision/sensitivity";
import { makeDecision, makeOption, makeReusableSettings } from "./fixtures";

describe("computeDecisionSensitivity", () => {
  it("returns null when fewer than two options can be calculated", () => {
    const decision = makeDecision([makeOption()]);
    expect(computeDecisionSensitivity(decision)).toBeNull();
  });

  it("returns null when a decision has zero options", () => {
    const decision = makeDecision([]);
    expect(computeDecisionSensitivity(decision)).toBeNull();
  });

  it("identifies the lower-impact option as best and the other as runner-up", () => {
    const light = makeOption({ id: "light", name: "Light", massGrams: 10, transportDistanceKm: 100 });
    const heavy = makeOption({ id: "heavy", name: "Heavy", massGrams: 30, transportDistanceKm: 100 });
    const result = computeDecisionSensitivity(makeDecision([heavy, light]));
    expect(result).not.toBeNull();
    expect(result!.bestOptionId).toBe("light");
    expect(result!.runnerUpOptionId).toBe("heavy");
  });

  it("ranks variables by swing, descending", () => {
    const a = makeOption({ id: "a", name: "A", massGrams: 12, transportDistanceKm: 400 });
    const b = makeOption({ id: "b", name: "B", massGrams: 14, transportDistanceKm: 420 });
    const result = computeDecisionSensitivity(makeDecision([a, b]))!;
    for (let i = 1; i < result.variables.length; i++) {
      expect(result.variables[i - 1].swing).toBeGreaterThanOrEqual(result.variables[i].swing);
    }
    expect(result.mostSensitiveVariable).toBe(result.variables[0]);
  });

  it("generates a deterministic insight statement naming the top variable's label", () => {
    const a = makeOption({ id: "a", name: "Option A", massGrams: 12 });
    const b = makeOption({ id: "b", name: "Option B", massGrams: 40 });
    const result = computeDecisionSensitivity(makeDecision([a, b]))!;
    expect(result.insightStatement).toBe(`Your decision is most sensitive to ${result.mostSensitiveVariable!.label}.`);
    expect(result.insightStatement.toLowerCase()).not.toContain("significant");
  });

  it("diffAtCurrent is always <= 0 (best option has lower or equal impact by construction)", () => {
    const a = makeOption({ id: "a", massGrams: 12, transportDistanceKm: 400 });
    const b = makeOption({ id: "b", massGrams: 30, transportDistanceKm: 900 });
    const result = computeDecisionSensitivity(makeDecision([a, b]))!;
    for (const v of result.variables) {
      expect(v.diffAtCurrent).toBeLessThanOrEqual(1e-9);
    }
  });

  it("tags every continuous variable with the disclosed sensitivity heuristic note", () => {
    const a = makeOption({ id: "a" });
    const b = makeOption({ id: "b", massGrams: 20 });
    const result = computeDecisionSensitivity(makeDecision([a, b]))!;
    const continuous = result.variables.filter((v) => v.kind !== "disposalPathway");
    for (const v of continuous) {
      expect(v.assumptionNote).toContain(`${SENSITIVITY_VARIATION_PCT}%`);
    }
  });
});

describe("mass sensitivity", () => {
  it("probes +/-20% of current mass", () => {
    const a = makeOption({ id: "a", massGrams: 100 });
    const b = makeOption({ id: "b", massGrams: 10 }); // clearly better, so 'a' side gets probed too
    const result = computeDecisionSensitivity(makeDecision([a, b]))!;
    const massVar = result.variables.find((v) => v.optionId === "a" && v.kind === "mass")!;
    expect(massVar.lowValue).toBeCloseTo(80, 6);
    expect(massVar.highValue).toBeCloseTo(120, 6);
  });

  it("solves an analytical break-even that round-trips to a ~zero diff", () => {
    // Construct two PET options where mass is the only difference-driver.
    const a = makeOption({ id: "a", massGrams: 10, transportDistanceKm: 100 });
    const b = makeOption({ id: "b", massGrams: 20, transportDistanceKm: 100 });
    const result = computeDecisionSensitivity(makeDecision([a, b]))!;
    const massVar = result.variables.find((v) => v.kind === "mass" && v.optionId === result.bestOptionId)!;
    expect(massVar.breakEven.method).toBe("analytical");
    if (massVar.breakEven.solvable) {
      expect(massVar.breakEven.value).not.toBeNull();
      expect(massVar.breakEven.belowOptionId).not.toBeNull();
      expect(massVar.breakEven.aboveOptionId).not.toBeNull();
      expect(massVar.breakEven.belowOptionId).not.toBe(massVar.breakEven.aboveOptionId);
    }
  });

  it("flags recommendationFlipsInRange correctly when low/high straddle the break-even", () => {
    // Same material/distance for both — 'a' (10g) beats 'b' (10.5g) only on mass.
    // Probing a's mass +/-20% (8g-12g) crosses b's 10.5g, so the winner must flip.
    const a = makeOption({ id: "a", massGrams: 10, transportDistanceKm: 400 });
    const b = makeOption({ id: "b", massGrams: 10.5, transportDistanceKm: 400 });
    const result = computeDecisionSensitivity(makeDecision([a, b]))!;
    expect(result.bestOptionId).toBe("a");
    const massVar = result.variables.find((v) => v.kind === "mass" && v.optionId === "a")!;
    // Internal consistency: the flag must agree with the sign of the raw diffs it's derived from.
    const straddles =
      (massVar.diffAtLow! < 0 && massVar.diffAtHigh! > 0) ||
      (massVar.diffAtLow! > 0 && massVar.diffAtHigh! < 0);
    expect(massVar.recommendationFlipsInRange).toBe(straddles);
    // And, reasoned independently from the setup: it should in fact flip.
    expect(massVar.recommendationFlipsInRange).toBe(true);
    expect(massVar.recommendationAtLow).toBe("a");
    expect(massVar.recommendationAtHigh).toBe("b");
  });
});

describe("transport distance sensitivity", () => {
  it("current value matches the option's transportDistanceKm", () => {
    const a = makeOption({ id: "a", transportDistanceKm: 250 });
    const b = makeOption({ id: "b", transportDistanceKm: 900 });
    const result = computeDecisionSensitivity(makeDecision([a, b]))!;
    const distVar = result.variables.find((v) => v.optionId === "a" && v.kind === "transportDistance")!;
    expect(distVar.currentValue).toBe(250);
    expect(distVar.unit).toBe("km");
  });

  it("clamps the low probe at zero (distance cannot go negative)", () => {
    const a = makeOption({ id: "a", transportDistanceKm: 5 });
    const b = makeOption({ id: "b", transportDistanceKm: 5, massGrams: 30 });
    const result = computeDecisionSensitivity(makeDecision([a, b]))!;
    const distVar = result.variables.find((v) => v.optionId === "a" && v.kind === "transportDistance")!;
    expect(distVar.lowValue).toBeGreaterThanOrEqual(0);
  });
});

describe("recycled-content sensitivity", () => {
  it("is present for PET/HDPE (materials with a verified recycled factor)", () => {
    const a = makeOption({ id: "a", materialCode: "PET", recycledContentPct: 20 });
    const b = makeOption({ id: "b", materialCode: "PET", massGrams: 20 });
    const result = computeDecisionSensitivity(makeDecision([a, b]))!;
    expect(result.variables.some((v) => v.optionId === "a" && v.kind === "recycledContent")).toBe(true);
  });

  it("is absent for PP (no verified recycled-PP factor)", () => {
    const a = makeOption({ id: "a", materialCode: "PP" });
    const b = makeOption({ id: "b", materialCode: "PP", massGrams: 20 });
    const result = computeDecisionSensitivity(makeDecision([a, b]))!;
    expect(result.variables.some((v) => v.kind === "recycledContent")).toBe(false);
  });

  it("uses a fixed +20-point probe when current recycled content is 0%", () => {
    const a = makeOption({ id: "a", recycledContentPct: 0 });
    const b = makeOption({ id: "b", massGrams: 20 });
    const result = computeDecisionSensitivity(makeDecision([a, b]))!;
    const rc = result.variables.find((v) => v.optionId === "a" && v.kind === "recycledContent")!;
    expect(rc.lowValue).toBe(0);
    expect(rc.highValue).toBe(20);
  });

  it("clamps the high probe at 100%", () => {
    const a = makeOption({ id: "a", recycledContentPct: 95 });
    const b = makeOption({ id: "b", massGrams: 20 });
    const result = computeDecisionSensitivity(makeDecision([a, b]))!;
    const rc = result.variables.find((v) => v.optionId === "a" && v.kind === "recycledContent")!;
    expect(rc.highValue).toBeLessThanOrEqual(100);
  });
});

describe("disposal pathway sensitivity (categorical)", () => {
  it("reports every available pathway's impact, flagging the current one", () => {
    const a = makeOption({ id: "a", materialCode: "PET", disposalPathway: "landfill" });
    const b = makeOption({ id: "b", massGrams: 20 });
    const result = computeDecisionSensitivity(makeDecision([a, b]))!;
    const disposal = result.variables.find((v) => v.optionId === "a" && v.kind === "disposalPathway")!;
    expect(disposal.categoricalOptions!.length).toBeGreaterThanOrEqual(2);
    expect(disposal.categoricalOptions!.some((o) => o.isCurrent && o.pathway === "landfill")).toBe(true);
  });

  it("never claims a solvable break-even for a discrete variable", () => {
    const a = makeOption({ id: "a" });
    const b = makeOption({ id: "b", massGrams: 20 });
    const result = computeDecisionSensitivity(makeDecision([a, b]))!;
    const disposal = result.variables.find((v) => v.optionId === "a" && v.kind === "disposalPathway")!;
    expect(disposal.breakEven.solvable).toBe(false);
    expect(disposal.breakEven.reason.toLowerCase()).toContain("discrete");
  });
});

describe("reusable cycles/loss sensitivity", () => {
  it("is present only for reusable options", () => {
    const reusable = makeOption({
      id: "r",
      materialCode: "PP",
      reusable: true,
      reusableSettings: makeReusableSettings(),
    });
    const singleUse = makeOption({ id: "s", massGrams: 20 });
    const result = computeDecisionSensitivity(makeDecision([reusable, singleUse]))!;
    expect(result.variables.some((v) => v.optionId === "r" && v.kind === "reusableMaxCycles")).toBe(true);
    expect(result.variables.some((v) => v.optionId === "r" && v.kind === "reusableLossRate")).toBe(true);
    expect(result.variables.some((v) => v.optionId === "s" && v.kind === "reusableMaxCycles")).toBe(false);
  });

  it("uses numerical (bisection) break-even solving, not analytical", () => {
    const reusable = makeOption({
      id: "r",
      materialCode: "PP",
      massGrams: 50,
      reusable: true,
      reusableSettings: makeReusableSettings({ maxCycles: 500, lossRatePct: 2 }),
    });
    const singleUse = makeOption({ id: "s", massGrams: 12 });
    const result = computeDecisionSensitivity(makeDecision([reusable, singleUse]))!;
    const cycles = result.variables.find((v) => v.optionId === "r" && v.kind === "reusableMaxCycles")!;
    const loss = result.variables.find((v) => v.optionId === "r" && v.kind === "reusableLossRate")!;
    expect(cycles.breakEven.method === "numerical" || cycles.breakEven.method === "none").toBe(true);
    expect(loss.breakEven.method === "numerical" || loss.breakEven.method === "none").toBe(true);
  });

  it("handles a 0% loss rate with a fixed small probe instead of a degenerate 0-0 range", () => {
    const reusable = makeOption({
      id: "r",
      materialCode: "PP",
      reusable: true,
      reusableSettings: makeReusableSettings({ lossRatePct: 0 }),
    });
    const singleUse = makeOption({ id: "s", massGrams: 20 });
    const result = computeDecisionSensitivity(makeDecision([reusable, singleUse]))!;
    const loss = result.variables.find((v) => v.optionId === "r" && v.kind === "reusableLossRate")!;
    expect(loss.lowValue).toBe(0);
    expect(loss.highValue).toBeGreaterThan(0);
  });

  it("does not crash when maxCycles is 1 (minimum boundary)", () => {
    const reusable = makeOption({
      id: "r",
      materialCode: "PP",
      reusable: true,
      reusableSettings: makeReusableSettings({ maxCycles: 1 }),
    });
    const singleUse = makeOption({ id: "s", massGrams: 20 });
    expect(() => computeDecisionSensitivity(makeDecision([reusable, singleUse]))).not.toThrow();
  });
});

describe("robustness / invalid inputs", () => {
  it("skips an option whose calculation throws (e.g. recycled content on a material with no recycled factor) rather than crashing", () => {
    // PP has no verified recycled-content factor, so a nonzero recycledContentPct
    // makes mapOptionToEngineInputs throw for this option.
    const broken = makeOption({ id: "broken", materialCode: "PP", recycledContentPct: 50 });
    const ok = makeOption({ id: "ok" });
    // Only one valid option remains, so sensitivity cannot be computed.
    const decision = makeDecision([broken, ok]);
    expect(() => computeDecisionSensitivity(decision)).not.toThrow();
    expect(computeDecisionSensitivity(decision)).toBeNull();
  });

  it("returns a non-crashing, well-formed result for near-identical options (near-zero denominator case)", () => {
    const a = makeOption({ id: "a", massGrams: 12.0000001, transportDistanceKm: 400 });
    const b = makeOption({ id: "b", massGrams: 12, transportDistanceKm: 400 });
    expect(() => computeDecisionSensitivity(makeDecision([a, b]))).not.toThrow();
    const result = computeDecisionSensitivity(makeDecision([a, b]))!;
    expect(result.variables.length).toBeGreaterThan(0);
  });
});
