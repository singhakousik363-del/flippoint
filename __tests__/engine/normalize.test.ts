import { describe, expect, it } from "vitest";
import {
  getFactor,
  interpolateRecycledContent,
  listFactors,
  MissingFactorError,
  transportFactorPerKgKm,
  washingEmissionsPerItem,
} from "@/lib/engine/normalize";

describe("getFactor", () => {
  it("returns a known factor by id", () => {
    const factor = getFactor("virgin-pet-production");
    expect(factor.value).toBeCloseTo(2.746, 10);
  });

  it("throws MissingFactorError for an unknown id", () => {
    expect(() => getFactor("nonexistent-factor")).toThrow(MissingFactorError);
  });

  it("includes the documented pending reason for a known-pending id", () => {
    expect(() => getFactor("virgin-pla-production")).toThrow(/known pending item/);
  });

  it("fails clearly (does not silently substitute a default) for any missing factor", () => {
    let caught: unknown;
    try {
      getFactor("totally-made-up-id");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(MissingFactorError);
    expect((caught as MissingFactorError).factorId).toBe("totally-made-up-id");
  });
});

describe("listFactors", () => {
  it("returns only factors that pass schema validation (dataset loaded without throwing)", () => {
    expect(listFactors().length).toBeGreaterThan(0);
  });
});

describe("transportFactorPerKgKm", () => {
  it("divides a tonne.km factor by 1000", () => {
    const factor = getFactor("road-freight-hgv-average");
    expect(transportFactorPerKgKm(factor)).toBeCloseTo(factor.value / 1000, 12);
  });

  it("rejects a factor that is not category=transport", () => {
    const factor = getFactor("virgin-pet-production");
    expect(() => transportFactorPerKgKm(factor)).toThrow(/not a transport factor/);
  });
});

describe("washingEmissionsPerItem", () => {
  it("combines kWh/rack x kgCO2e/kWh / itemsPerWash", () => {
    const washing = getFactor("commercial-dishwasher-washing-energy");
    const grid = getFactor("us-grid-electricity-average");
    const perItem = washingEmissionsPerItem(washing, grid, 24);
    expect(perItem).toBeCloseTo((washing.value * grid.value) / 24, 12);
  });

  it("rejects itemsPerWash <= 0", () => {
    const washing = getFactor("commercial-dishwasher-washing-energy");
    const grid = getFactor("us-grid-electricity-average");
    expect(() => washingEmissionsPerItem(washing, grid, 0)).toThrow(/itemsPerWash must be > 0/);
  });

  it("rejects a washing factor with the wrong category", () => {
    const notWashing = getFactor("virgin-pet-production");
    const grid = getFactor("us-grid-electricity-average");
    expect(() => washingEmissionsPerItem(notWashing, grid, 10)).toThrow(/not a reuse-washing factor/);
  });

  it("rejects a grid factor with the wrong category", () => {
    const washing = getFactor("commercial-dishwasher-washing-energy");
    const notGrid = getFactor("virgin-pet-production");
    expect(() => washingEmissionsPerItem(washing, notGrid, 10)).toThrow(/not a grid-electricity factor/);
  });
});

describe("interpolateRecycledContent", () => {
  it("interpolates linearly between virgin and recycled factors", () => {
    const virgin = getFactor("virgin-pet-production");
    const recycled = getFactor("recycled-pet-production");
    const result = interpolateRecycledContent(virgin, recycled, 0.3);
    expect(result).toBeCloseTo(0.3 * recycled.value + 0.7 * virgin.value, 12);
  });

  it("rejects a fraction outside [0, 1]", () => {
    const virgin = getFactor("virgin-pet-production");
    const recycled = getFactor("recycled-pet-production");
    expect(() => interpolateRecycledContent(virgin, recycled, 1.5)).toThrow(
      /recycledContentFraction must be between 0 and 1/,
    );
    expect(() => interpolateRecycledContent(virgin, recycled, -0.1)).toThrow(
      /recycledContentFraction must be between 0 and 1/,
    );
  });

  it("rejects mismatched units", () => {
    const virgin = getFactor("virgin-pet-production"); // kgCO2e/kg
    const transport = getFactor("road-freight-hgv-average"); // kgCO2e/tonne.km
    expect(() => interpolateRecycledContent(virgin, transport, 0.5)).toThrow(/mismatched units/);
  });
});
