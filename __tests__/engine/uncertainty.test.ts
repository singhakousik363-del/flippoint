import { describe, expect, it } from "vitest";
import { sumImpactRanges, scaleImpactRange, type ImpactResult } from "@/lib/engine/engine";

describe("sumImpactRanges (uncertainty propagation)", () => {
  it("sums central, low, and high independently when all components have ranges", () => {
    const a: ImpactResult = { central: 1, low: 0.8, high: 1.3, confidence: "high" };
    const b: ImpactResult = { central: 2, low: 1.5, high: 2.6, confidence: "medium" };
    const sum = sumImpactRanges([a, b]);
    expect(sum.central).toBeCloseTo(3, 10);
    expect(sum.low).toBeCloseTo(2.3, 10);
    expect(sum.high).toBeCloseTo(3.9, 10);
  });

  it("takes the minimum confidence across components", () => {
    const a: ImpactResult = { central: 1, low: 0.8, high: 1.3, confidence: "high" };
    const b: ImpactResult = { central: 2, low: 1.5, high: 2.6, confidence: "low" };
    expect(sumImpactRanges([a, b]).confidence).toBe("low");
  });

  it("drops the range entirely (not zero-width) if any component lacks one", () => {
    const a: ImpactResult = { central: 1, low: 0.8, high: 1.3, confidence: "high" };
    const b: ImpactResult = { central: 2, confidence: "low" }; // no range
    const sum = sumImpactRanges([a, b]);
    expect(sum.central).toBeCloseTo(3, 10);
    expect(sum.low).toBeUndefined();
    expect(sum.high).toBeUndefined();
  });

  it("throws on an empty list", () => {
    expect(() => sumImpactRanges([])).toThrow();
  });
});

describe("scaleImpactRange", () => {
  it("scales central/low/high by a positive multiplier", () => {
    const range: ImpactResult = { central: 2, low: 1, high: 3, confidence: "medium" };
    const scaled = scaleImpactRange(range, 10);
    expect(scaled.central).toBe(20);
    expect(scaled.low).toBe(10);
    expect(scaled.high).toBe(30);
  });

  it("preserves undefined low/high", () => {
    const range: ImpactResult = { central: 2, confidence: "low" };
    const scaled = scaleImpactRange(range, 10);
    expect(scaled.low).toBeUndefined();
    expect(scaled.high).toBeUndefined();
  });
});
