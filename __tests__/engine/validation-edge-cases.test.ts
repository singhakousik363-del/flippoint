import { describe, expect, it } from "vitest";
import { emissionFactorSchema } from "@/lib/validation/emission-factor";
import { reusableItemSchema, singleUseItemSchema, transportInputSchema } from "@/lib/validation/inputs";

const validSource = {
  name: "Test Source",
  url: "https://example.com/report.pdf",
  publicationYear: 2020,
  accessedDate: "2026-09-05",
};

describe("emissionFactorSchema", () => {
  it("accepts a factor with no range, confidence low", () => {
    const result = emissionFactorSchema.safeParse({
      id: "x",
      material: "Test",
      category: "production",
      value: 1,
      unit: "kgCO2e/kg",
      uncertainty: { confidence: "low" },
      source: validSource,
      calculationBasis: "basis",
      assumptions: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a factor with no range but confidence claimed above low", () => {
    const result = emissionFactorSchema.safeParse({
      id: "x",
      material: "Test",
      category: "production",
      value: 1,
      unit: "kgCO2e/kg",
      uncertainty: { confidence: "high" },
      source: validSource,
      calculationBasis: "basis",
      assumptions: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a factor with only one of low/high present", () => {
    const result = emissionFactorSchema.safeParse({
      id: "x",
      material: "Test",
      category: "production",
      value: 1,
      unit: "kgCO2e/kg",
      uncertainty: { low: 0.5, confidence: "medium" },
      source: validSource,
      calculationBasis: "basis",
      assumptions: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects low > value", () => {
    const result = emissionFactorSchema.safeParse({
      id: "x",
      material: "Test",
      category: "production",
      value: 1,
      unit: "kgCO2e/kg",
      uncertainty: { low: 1.5, high: 2, confidence: "high" },
      source: validSource,
      calculationBasis: "basis",
      assumptions: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects high < value", () => {
    const result = emissionFactorSchema.safeParse({
      id: "x",
      material: "Test",
      category: "production",
      value: 1,
      unit: "kgCO2e/kg",
      uncertainty: { low: 0.1, high: 0.5, confidence: "high" },
      source: validSource,
      calculationBasis: "basis",
      assumptions: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid source URL", () => {
    const result = emissionFactorSchema.safeParse({
      id: "x",
      material: "Test",
      category: "production",
      value: 1,
      unit: "kgCO2e/kg",
      uncertainty: { confidence: "low" },
      source: { ...validSource, url: "not-a-url" },
      calculationBasis: "basis",
      assumptions: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown category", () => {
    const result = emissionFactorSchema.safeParse({
      id: "x",
      material: "Test",
      category: "made-up-category",
      value: 1,
      unit: "kgCO2e/kg",
      uncertainty: { confidence: "low" },
      source: validSource,
      calculationBasis: "basis",
      assumptions: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("singleUseItemSchema", () => {
  const base = {
    id: "cup-1",
    label: "Cup",
    productionFactorId: "virgin-pet-production",
    massKg: 0.012,
    disposalPathway: "landfill" as const,
    disposalFactorId: "pet-landfill",
  };

  it("accepts a valid item with no recycled content", () => {
    expect(singleUseItemSchema.safeParse(base).success).toBe(true);
  });

  it("rejects zero or negative mass", () => {
    expect(singleUseItemSchema.safeParse({ ...base, massKg: 0 }).success).toBe(false);
    expect(singleUseItemSchema.safeParse({ ...base, massKg: -1 }).success).toBe(false);
  });

  it("rejects recycledContentFraction outside [0, 1]", () => {
    expect(
      singleUseItemSchema.safeParse({ ...base, recycledContentFraction: 1.5 }).success,
    ).toBe(false);
    expect(
      singleUseItemSchema.safeParse({ ...base, recycledContentFraction: -0.1 }).success,
    ).toBe(false);
  });

  it("rejects a positive recycledContentFraction without a recycledProductionFactorId", () => {
    const result = singleUseItemSchema.safeParse({ ...base, recycledContentFraction: 0.3 });
    expect(result.success).toBe(false);
  });

  it("accepts a positive recycledContentFraction with a recycledProductionFactorId", () => {
    const result = singleUseItemSchema.safeParse({
      ...base,
      recycledContentFraction: 0.3,
      recycledProductionFactorId: "recycled-pet-production",
    });
    expect(result.success).toBe(true);
  });

  it("accepts recycledContentFraction of exactly 0 without requiring the recycled factor id", () => {
    const result = singleUseItemSchema.safeParse({ ...base, recycledContentFraction: 0 });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid disposal pathway", () => {
    const result = singleUseItemSchema.safeParse({ ...base, disposalPathway: "space" });
    expect(result.success).toBe(false);
  });
});

describe("reusableItemSchema", () => {
  const base = {
    id: "reusable-1",
    label: "Reusable cup",
    productionFactorId: "virgin-pp-production",
    massKg: 0.05,
    maxCycles: 500,
    survivalProbability: 0.98,
    washingEnergyFactorId: "commercial-dishwasher-washing-energy",
    gridFactorId: "us-grid-electricity-average",
    itemsPerWash: 24,
    disposalPathway: "landfill" as const,
    disposalFactorId: "pp-landfill",
  };

  it("accepts a valid reusable item", () => {
    expect(reusableItemSchema.safeParse(base).success).toBe(true);
  });

  it("rejects survivalProbability of 0", () => {
    expect(reusableItemSchema.safeParse({ ...base, survivalProbability: 0 }).success).toBe(false);
  });

  it("rejects survivalProbability above 1", () => {
    expect(reusableItemSchema.safeParse({ ...base, survivalProbability: 1.1 }).success).toBe(false);
  });

  it("accepts survivalProbability of exactly 1 (no loss)", () => {
    expect(reusableItemSchema.safeParse({ ...base, survivalProbability: 1 }).success).toBe(true);
  });

  it("rejects a non-integer or non-positive maxCycles", () => {
    expect(reusableItemSchema.safeParse({ ...base, maxCycles: 0 }).success).toBe(false);
    expect(reusableItemSchema.safeParse({ ...base, maxCycles: 10.5 }).success).toBe(false);
  });

  it("rejects a negative returnTransportPerUseKgCo2e", () => {
    expect(
      reusableItemSchema.safeParse({ ...base, returnTransportPerUseKgCo2e: -0.001 }).success,
    ).toBe(false);
  });
});

describe("transportInputSchema", () => {
  it("accepts a valid transport input", () => {
    const result = transportInputSchema.safeParse({
      factorId: "road-freight-hgv-average",
      distanceKm: 400,
      isDefaultAssumption: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative distance", () => {
    const result = transportInputSchema.safeParse({
      factorId: "road-freight-hgv-average",
      distanceKm: -1,
      isDefaultAssumption: false,
    });
    expect(result.success).toBe(false);
  });

  it("accepts zero distance", () => {
    const result = transportInputSchema.safeParse({
      factorId: "road-freight-hgv-average",
      distanceKm: 0,
      isDefaultAssumption: false,
    });
    expect(result.success).toBe(true);
  });
});
