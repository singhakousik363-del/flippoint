import { describe, expect, it } from "vitest";
import { determineConfidence, MATERIALITY_THRESHOLD_PCT, type ImpactResult } from "@/lib/engine/engine";

describe("determineConfidence (methodology §3, revised)", () => {
  it("returns High when ranges do not overlap", () => {
    const a: ImpactResult = { central: 1, low: 0.9, high: 1.1, confidence: "high" };
    const b: ImpactResult = { central: 3, low: 2.8, high: 3.2, confidence: "high" };
    const assessment = determineConfidence(a, b);
    expect(assessment.tier).toBe("High");
    expect(assessment.rangesOverlap).toBe(false);
  });

  it("returns Medium when ranges overlap but central estimates differ materially", () => {
    const a: ImpactResult = { central: 1, low: 0.5, high: 1.5, confidence: "high" };
    const b: ImpactResult = { central: 1.3, low: 1.0, high: 1.6, confidence: "high" };
    // relative diff = |1 - 1.3| / 1.3 ≈ 23% >= 20% threshold
    const assessment = determineConfidence(a, b);
    expect(assessment.tier).toBe("Medium");
    expect(assessment.rangesOverlap).toBe(true);
    expect(assessment.relativeDifferencePct).toBeGreaterThanOrEqual(MATERIALITY_THRESHOLD_PCT);
  });

  it("returns Low when ranges substantially overlap and centrals are close", () => {
    const a: ImpactResult = { central: 1.0, low: 0.5, high: 1.5, confidence: "high" };
    const b: ImpactResult = { central: 1.05, low: 0.6, high: 1.5, confidence: "high" };
    const assessment = determineConfidence(a, b);
    expect(assessment.tier).toBe("Low");
  });

  it("downgrades High to Medium when a source-quality flag is set", () => {
    const a: ImpactResult = { central: 1, low: 0.9, high: 1.1, confidence: "high" };
    const b: ImpactResult = { central: 3, low: 2.8, high: 3.2, confidence: "high" };
    const assessment = determineConfidence(a, b, { sourceQualityFlag: true });
    expect(assessment.tier).toBe("Medium");
    expect(assessment.sourceQualityDowngraded).toBe(true);
  });

  it("downgrades based on a 'low' confidence input even without an explicit flag", () => {
    const a: ImpactResult = { central: 1, low: 0.9, high: 1.1, confidence: "low" };
    const b: ImpactResult = { central: 3, low: 2.8, high: 3.2, confidence: "high" };
    const assessment = determineConfidence(a, b);
    expect(assessment.tier).toBe("Medium"); // would be High, downgraded once
  });

  it("cannot claim High when a range is missing on either side", () => {
    const a: ImpactResult = { central: 1, confidence: "low" }; // no range
    const b: ImpactResult = { central: 3, low: 2.8, high: 3.2, confidence: "high" };
    const assessment = determineConfidence(a, b);
    expect(assessment.tier).not.toBe("High");
  });

  it("never uses the phrase 'statistically indistinguishable' in its explanation", () => {
    const a: ImpactResult = { central: 1.0, low: 0.5, high: 1.5, confidence: "high" };
    const b: ImpactResult = { central: 1.05, low: 0.6, high: 1.5, confidence: "high" };
    const assessment = determineConfidence(a, b);
    expect(assessment.explanation.toLowerCase()).not.toContain("statistically indistinguishable");
  });

  it("honors a custom materiality threshold", () => {
    const a: ImpactResult = { central: 1, low: 0.5, high: 1.5, confidence: "high" };
    const b: ImpactResult = { central: 1.05, low: 0.6, high: 1.5, confidence: "high" }; // ~4.8% diff
    const strict = determineConfidence(a, b, { materialityThresholdPct: 1 });
    expect(strict.tier).toBe("Medium");
    const lenient = determineConfidence(a, b, { materialityThresholdPct: 50 });
    expect(lenient.tier).toBe("Low");
  });
});
