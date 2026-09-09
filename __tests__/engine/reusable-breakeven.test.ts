import { describe, expect, it } from "vitest";
import {
  assessReusableFeasibility,
  calculateBreakEven,
  calculateEffectiveCycles,
  calculateReusableCumulative,
  calculateReusableFixedCosts,
  calculateReusableRecurringCosts,
  type ReusableFixedCosts,
  type ReusableRecurringCosts,
} from "@/lib/engine/engine";
import type { ReusableItem, TransportInput } from "@/types/domain";

function reusableItem(overrides: Partial<ReusableItem> = {}): ReusableItem {
  return {
    id: "reusable-cup",
    label: "Reusable PP cup",
    productionFactorId: "virgin-pp-production",
    massKg: 0.05,
    maxCycles: 500,
    survivalProbability: 0.98,
    washingEnergyFactorId: "commercial-dishwasher-washing-energy",
    gridFactorId: "us-grid-electricity-average",
    itemsPerWash: 24,
    disposalPathway: "landfill",
    disposalFactorId: "pp-landfill",
    ...overrides,
  };
}

const transportInitial: TransportInput = {
  factorId: "road-freight-hgv-average",
  distanceKm: 400,
  isDefaultAssumption: true,
};

describe("calculateReusableCumulative (methodology §2, revised explicit form)", () => {
  it("matches P_r + T_r + N*W + N*R_t + E_r exactly", () => {
    const item = reusableItem();
    const fixed = calculateReusableFixedCosts(item, transportInitial);
    const recurring = calculateReusableRecurringCosts(item);
    const n = 10;
    const cumulative = calculateReusableCumulative(fixed, recurring, n);
    const expected =
      fixed.production +
      fixed.transportInitial +
      n * recurring.washingPerUse +
      n * recurring.returnTransportPerUse +
      fixed.endOfLife;
    expect(cumulative).toBeCloseTo(expected, 12);
  });

  it("at N=0, cumulative equals the fixed costs only", () => {
    const item = reusableItem();
    const fixed = calculateReusableFixedCosts(item, transportInitial);
    const recurring = calculateReusableRecurringCosts(item);
    const cumulative = calculateReusableCumulative(fixed, recurring, 0);
    expect(cumulative).toBeCloseTo(fixed.production + fixed.transportInitial + fixed.endOfLife, 12);
  });

  it("increases monotonically with N when recurring costs are positive", () => {
    const item = reusableItem();
    const fixed = calculateReusableFixedCosts(item, transportInitial);
    const recurring = calculateReusableRecurringCosts(item);
    const at5 = calculateReusableCumulative(fixed, recurring, 5);
    const at50 = calculateReusableCumulative(fixed, recurring, 50);
    expect(at50).toBeGreaterThan(at5);
  });

  it("rejects a negative N", () => {
    const item = reusableItem();
    const fixed = calculateReusableFixedCosts(item, transportInitial);
    const recurring = calculateReusableRecurringCosts(item);
    expect(() => calculateReusableCumulative(fixed, recurring, -1)).toThrow(/n \(number of uses\)/);
  });
});

describe("calculateEffectiveCycles (N_effective = min(N_max, 1/(1-p)))", () => {
  it("caps at the loss-implied expectation when it is below the rated max", () => {
    // 1/(1-0.98) = 50, well below maxCycles=500
    expect(calculateEffectiveCycles(500, 0.98)).toBeCloseTo(50, 10);
  });

  it("caps at the rated max when survival probability implies a longer life", () => {
    // 1/(1-0.999) = 1000, above maxCycles=500
    expect(calculateEffectiveCycles(500, 0.999)).toBe(500);
  });

  it("returns exactly maxCycles when there is no loss at all (p=1)", () => {
    expect(calculateEffectiveCycles(500, 1)).toBe(500);
  });

  it("rejects maxCycles <= 0", () => {
    expect(() => calculateEffectiveCycles(0, 0.98)).toThrow(/maxCycles must be > 0/);
  });

  it("rejects survivalProbability outside (0, 1]", () => {
    expect(() => calculateEffectiveCycles(500, 0)).toThrow(/survivalProbability/);
    expect(() => calculateEffectiveCycles(500, 1.5)).toThrow(/survivalProbability/);
  });
});

describe("calculateBreakEven (closed form N*)", () => {
  const fixed: ReusableFixedCosts = { production: 0.09, transportInitial: 0.01, endOfLife: 0.005 };
  const recurring: ReusableRecurringCosts = { washingPerUse: 0.002, returnTransportPerUse: 0.001 };

  it("solves N* = (P_r+T_r+E_r) / (singleUse - W - R_t)", () => {
    const singleUseImpactPerUse = 0.04;
    const result = calculateBreakEven(fixed, recurring, singleUseImpactPerUse);
    expect(result.reachable).toBe(true);
    if (result.reachable) {
      const expected = (0.09 + 0.01 + 0.005) / (0.04 - 0.002 - 0.001);
      expect(result.breakEvenUses).toBeCloseTo(expected, 10);
    }
  });

  it("returns no-break-even when the denominator is exactly zero", () => {
    // singleUse - W - R_t = 0.003 - 0.002 - 0.001 = 0
    const result = calculateBreakEven(fixed, recurring, 0.003);
    expect(result.reachable).toBe(false);
  });

  it("returns no-break-even when the denominator is negative", () => {
    // recurring per-use cost of the reusable exceeds a single-use item's full impact
    const result = calculateBreakEven(fixed, recurring, 0.002);
    expect(result.reachable).toBe(false);
    if (!result.reachable) {
      expect(result.reason).toMatch(/no finite number of uses/i);
    }
  });
});

describe("assessReusableFeasibility", () => {
  const fixed: ReusableFixedCosts = { production: 0.09, transportInitial: 0.01, endOfLife: 0.005 };
  const recurring: ReusableRecurringCosts = { washingPerUse: 0.002, returnTransportPerUse: 0 };

  it("is feasible when break-even uses fall within the effective lifetime", () => {
    const breakEven = calculateBreakEven(fixed, recurring, 0.04); // N* ≈ 2.76
    const feasibility = assessReusableFeasibility(breakEven, 50);
    expect(feasibility.feasible).toBe(true);
  });

  it("is infeasible when break-even uses exceed the effective lifetime", () => {
    const breakEven = calculateBreakEven(fixed, recurring, 0.0205); // N* is large
    const feasibility = assessReusableFeasibility(breakEven, 5);
    expect(feasibility.feasible).toBe(false);
    expect(feasibility.note).toMatch(/not expected to reach environmental break-even/);
  });

  it("is infeasible whenever there is no finite break-even at all", () => {
    const breakEven = calculateBreakEven(fixed, recurring, 0.001);
    const feasibility = assessReusableFeasibility(breakEven, 500);
    expect(feasibility.feasible).toBe(false);
  });
});
