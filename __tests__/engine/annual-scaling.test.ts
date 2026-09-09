import { describe, expect, it } from "vitest";
import { calculateAnnualImpact, type ImpactResult } from "@/lib/engine/engine";

describe("calculateAnnualImpact", () => {
  it("scales central, low, and high by the annual volume", () => {
    const unit: ImpactResult = { central: 0.04, low: 0.03, high: 0.05, confidence: "medium" };
    const annual = calculateAnnualImpact(unit, 26000);
    expect(annual.central).toBeCloseTo(0.04 * 26000, 8);
    expect(annual.low).toBeCloseTo(0.03 * 26000, 8);
    expect(annual.high).toBeCloseTo(0.05 * 26000, 8);
    expect(annual.confidence).toBe("medium");
  });

  it("leaves low/high undefined when the unit impact has no range", () => {
    const unit: ImpactResult = { central: 0.04, confidence: "low" };
    const annual = calculateAnnualImpact(unit, 1000);
    expect(annual.low).toBeUndefined();
    expect(annual.high).toBeUndefined();
    expect(annual.central).toBeCloseTo(40, 8);
  });

  it("returns zero impact at zero volume", () => {
    const unit: ImpactResult = { central: 0.04, confidence: "low" };
    const annual = calculateAnnualImpact(unit, 0);
    expect(annual.central).toBe(0);
  });

  it("rejects a negative annual volume", () => {
    const unit: ImpactResult = { central: 0.04, confidence: "low" };
    expect(() => calculateAnnualImpact(unit, -1)).toThrow(/annualVolume must be >= 0/);
  });
});
