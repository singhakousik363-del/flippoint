import { describe, expect, it } from "vitest";
import {
  calculateDisposalImpact,
  calculateProductionImpact,
  calculateSingleUseImpact,
} from "@/lib/engine/engine";
import { getDisposalOptionsFor, getMaterial } from "@/lib/data/catalog";
import type { SingleUseItem, TransportInput } from "@/types/domain";

function baseItem(overrides: Partial<SingleUseItem> = {}): SingleUseItem {
  return {
    id: "test-paperboard-item",
    label: "Test paperboard box",
    productionFactorId: "virgin-paperboard-production",
    massKg: 0.012,
    disposalPathway: "landfill",
    disposalFactorId: "paperboard-landfill",
    ...overrides,
  };
}

describe("calculateProductionImpact (paperboard)", () => {
  it("multiplies the virgin paperboard production factor by item mass", () => {
    const { result, interpolated } = calculateProductionImpact(baseItem());
    expect(result.central).toBeCloseTo(0.8818 * 0.012, 10);
    expect(interpolated).toBe(false);
  });

  it("carries the factor's confidence level through (no source-stated range)", () => {
    const { result } = calculateProductionImpact(baseItem());
    expect(result.confidence).toBe("low");
  });
});

describe("calculateDisposalImpact (paperboard)", () => {
  it("multiplies the disposal factor by item mass (landfill)", () => {
    const { result } = calculateDisposalImpact("paperboard-landfill", 0.012);
    expect(result.central).toBeCloseTo(0.496 * 0.012, 10);
  });

  it("supports a net-negative combustion factor (biogenic CO2 excluded, avoided-utility credit retained)", () => {
    const { result } = calculateDisposalImpact("paperboard-combustion", 0.012);
    expect(result.central).toBeLessThan(0);
    expect(result.central).toBeCloseTo(-0.5291 * 0.012, 10);
  });

  it("supports a negative net factor for the recycling credit", () => {
    const { result } = calculateDisposalImpact("paperboard-recycling-credit", 0.012);
    expect(result.central).toBeLessThan(0);
    expect(result.central).toBeCloseTo(-3.4392 * 0.012, 10);
  });
});

describe("calculateSingleUseImpact (full breakdown, paperboard)", () => {
  it("sums production + transport + disposal into a total", () => {
    const item: SingleUseItem = {
      id: "box-a",
      label: "Paperboard box",
      productionFactorId: "virgin-paperboard-production",
      massKg: 0.012,
      disposalPathway: "recycling",
      disposalFactorId: "paperboard-recycling-credit",
    };
    const transport: TransportInput = {
      factorId: "road-freight-hgv-average",
      distanceKm: 400,
      isDefaultAssumption: true,
    };
    const breakdown = calculateSingleUseImpact(item, transport);
    const expectedTotal =
      breakdown.production.central + breakdown.transport.central + breakdown.disposal.central;
    expect(breakdown.total.central).toBeCloseTo(expectedTotal, 12);
    expect(breakdown.factorsUsed).toHaveLength(3);
  });
});

describe("MATERIAL_CATALOG (paperboard)", () => {
  it("lists paperboard with production and all three disposal pathways", () => {
    const material = getMaterial("PAPERBOARD");
    expect(material.virginFactorId).toBe("virgin-paperboard-production");
    expect(material.recycledFactorId).toBeUndefined();

    const disposalOptions = getDisposalOptionsFor("PAPERBOARD");
    expect(disposalOptions.map((o) => o.pathway).sort()).toEqual([
      "combustion",
      "landfill",
      "recycling",
    ]);
  });
});
