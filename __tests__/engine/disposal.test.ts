import { describe, expect, it } from "vitest";
import { calculateDisposalImpact, calculateSingleUseImpact } from "@/lib/engine/engine";
import type { SingleUseItem, TransportInput } from "@/types/domain";

describe("calculateDisposalImpact", () => {
  it("multiplies the disposal factor by item mass (landfill)", () => {
    const { result } = calculateDisposalImpact("pet-landfill", 0.012);
    expect(result.central).toBeCloseTo(0.0441 * 0.012, 10);
  });

  it("multiplies the disposal factor by item mass (combustion)", () => {
    const { result } = calculateDisposalImpact("pet-combustion", 0.012);
    expect(result.central).toBeCloseTo(1.3669 * 0.012, 10);
  });

  it("supports a negative net factor for a recycling credit", () => {
    const { result } = calculateDisposalImpact("pet-recycling-credit", 0.012);
    expect(result.central).toBeLessThan(0);
    expect(result.central).toBeCloseTo(-1.2456 * 0.012, 10);
  });

  it("throws MissingFactorError for an unknown disposal factor id", () => {
    expect(() => calculateDisposalImpact("does-not-exist", 0.012)).toThrow(
      /No verified emission factor found/,
    );
  });

  it("throws a helpful error naming the pending gap for pp-recycling-credit", () => {
    expect(() => calculateDisposalImpact("pp-recycling-credit", 0.012)).toThrow(
      /pending item/,
    );
  });
});

describe("calculateSingleUseImpact (full breakdown)", () => {
  it("sums production + transport + disposal into a total", () => {
    const item: SingleUseItem = {
      id: "cup-a",
      label: "PET cup",
      productionFactorId: "virgin-pet-production",
      massKg: 0.012,
      disposalPathway: "landfill",
      disposalFactorId: "pet-landfill",
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
    expect(breakdown.flags.defaultTransportAssumption).toBe(true);
    expect(breakdown.flags.recycledContentInterpolated).toBe(false);
    expect(breakdown.factorsUsed).toHaveLength(3);
  });
});
