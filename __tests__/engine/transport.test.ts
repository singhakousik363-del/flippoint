import { describe, expect, it } from "vitest";
import { calculateTransportImpact } from "@/lib/engine/engine";

describe("calculateTransportImpact", () => {
  it("computes mass x distance x (factor / 1000) for a tonne.km factor", () => {
    const massKg = 0.012;
    const distanceKm = 400;
    const { result } = calculateTransportImpact(
      { factorId: "road-freight-hgv-average", distanceKm, isDefaultAssumption: false },
      massKg,
    );
    const expected = massKg * distanceKm * (0.09752 / 1000);
    expect(result.central).toBeCloseTo(expected, 12);
  });

  it("scales linearly with distance", () => {
    const massKg = 0.01;
    const near = calculateTransportImpact(
      { factorId: "road-freight-hgv-average", distanceKm: 100, isDefaultAssumption: false },
      massKg,
    ).result.central;
    const far = calculateTransportImpact(
      { factorId: "road-freight-hgv-average", distanceKm: 400, isDefaultAssumption: false },
      massKg,
    ).result.central;
    expect(far).toBeCloseTo(near * 4, 12);
  });

  it("is zero at zero distance", () => {
    const { result } = calculateTransportImpact(
      { factorId: "road-freight-hgv-average", distanceKm: 0, isDefaultAssumption: false },
      0.01,
    );
    expect(result.central).toBe(0);
  });

  it("throws MissingFactorError for an unknown transport factor id", () => {
    expect(() =>
      calculateTransportImpact(
        { factorId: "does-not-exist", distanceKm: 100, isDefaultAssumption: false },
        0.01,
      ),
    ).toThrow(/No verified emission factor found/);
  });

  it("rejects a factor that is not category=transport", () => {
    expect(() =>
      calculateTransportImpact(
        { factorId: "virgin-pet-production", distanceKm: 100, isDefaultAssumption: false },
        0.01,
      ),
    ).toThrow(/not a transport factor/);
  });
});
