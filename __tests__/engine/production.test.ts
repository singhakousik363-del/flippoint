import { describe, expect, it } from "vitest";
import { calculateProductionImpact } from "@/lib/engine/engine";
import type { SingleUseItem } from "@/types/domain";

function baseItem(overrides: Partial<SingleUseItem> = {}): SingleUseItem {
  return {
    id: "test-item",
    label: "Test cup",
    productionFactorId: "virgin-pet-production",
    massKg: 0.012,
    disposalPathway: "landfill",
    disposalFactorId: "pet-landfill",
    ...overrides,
  };
}

describe("calculateProductionImpact", () => {
  it("multiplies the virgin production factor by item mass", () => {
    const { result, interpolated } = calculateProductionImpact(baseItem());
    expect(result.central).toBeCloseTo(2.746 * 0.012, 10);
    expect(interpolated).toBe(false);
  });

  it("carries the factor's confidence level through when no recycled content", () => {
    const { result } = calculateProductionImpact(baseItem());
    expect(result.confidence).toBe("low"); // virgin-pet-production has no source-stated range
  });

  it("throws MissingFactorError for an unknown production factor id", () => {
    expect(() =>
      calculateProductionImpact(baseItem({ productionFactorId: "does-not-exist" })),
    ).toThrow(/No verified emission factor found/);
  });
});

describe("recycled-content interpolation (methodology §6)", () => {
  it("interpolates linearly between virgin and 100%-recycled factors", () => {
    const item = baseItem({
      recycledContentFraction: 0.3,
      recycledProductionFactorId: "recycled-pet-production",
    });
    const { result, interpolated, factorsUsed } = calculateProductionImpact(item);
    const expectedEffectiveFactor = 0.3 * 1.169 + 0.7 * 2.746;
    expect(interpolated).toBe(true);
    expect(result.central).toBeCloseTo(expectedEffectiveFactor * 0.012, 10);
    expect(factorsUsed).toHaveLength(2);
  });

  it("reduces to the pure virgin factor at R=0 even when a recycled factor id is supplied", () => {
    const item = baseItem({
      recycledContentFraction: 0,
      recycledProductionFactorId: "recycled-pet-production",
    });
    const { result, interpolated } = calculateProductionImpact(item);
    expect(interpolated).toBe(false);
    expect(result.central).toBeCloseTo(2.746 * 0.012, 10);
  });

  it("reduces to the pure 100%-recycled factor at R=1", () => {
    const item = baseItem({
      recycledContentFraction: 1,
      recycledProductionFactorId: "recycled-pet-production",
    });
    const { result } = calculateProductionImpact(item);
    expect(result.central).toBeCloseTo(1.169 * 0.012, 10);
  });

  it("caps confidence at medium even if endpoint factors were individually higher", () => {
    const item = baseItem({
      recycledContentFraction: 0.3,
      recycledProductionFactorId: "recycled-pet-production",
    });
    const { result } = calculateProductionImpact(item);
    expect(result.confidence).not.toBe("high");
  });

  it("throws when recycledContentFraction > 0 but recycledProductionFactorId is missing", () => {
    const item = baseItem({ recycledContentFraction: 0.3 });
    expect(() => calculateProductionImpact(item)).toThrow(/recycledProductionFactorId/);
  });
});
