import { describe, expect, it } from "vitest";
import {
  findRootBisection,
  oneAtATimeSensitivity,
  solveBreakEvenForVariable,
} from "@/lib/engine/sensitivity";

describe("oneAtATimeSensitivity", () => {
  it("ranks variables by impact swing, descending", () => {
    // impact = 2*mass + 0.1*distance
    const impactFn = (v: Record<string, number>) => 2 * v.mass + 0.1 * v.distance;
    const results = oneAtATimeSensitivity(
      [
        { name: "mass", low: 0.01, central: 0.02, high: 0.03 }, // swing = 2*(0.03-0.01) = 0.04
        { name: "distance", low: 100, central: 200, high: 300 }, // swing = 0.1*(300-100) = 20
      ],
      impactFn,
    );
    expect(results[0].name).toBe("distance");
    expect(results[0].swing).toBeCloseTo(20, 8);
    expect(results[1].name).toBe("mass");
    expect(results[1].swing).toBeCloseTo(0.04, 8);
  });

  it("holds all other variables at their central value while varying one", () => {
    const seen: Record<string, number>[] = [];
    const impactFn = (v: Record<string, number>) => {
      seen.push({ ...v });
      return v.a + v.b;
    };
    oneAtATimeSensitivity(
      [
        { name: "a", low: 0, central: 1, high: 2 },
        { name: "b", low: 10, central: 11, high: 12 },
      ],
      impactFn,
    );
    // While varying "a", "b" should stay at its central value (11), and vice versa.
    const varyingA = seen.filter((s) => s.a !== 1);
    expect(varyingA.every((s) => s.b === 11)).toBe(true);
    const varyingB = seen.filter((s) => s.b !== 11);
    expect(varyingB.every((s) => s.a === 1)).toBe(true);
  });

  it("returns an empty array for no variables", () => {
    expect(oneAtATimeSensitivity([], () => 0)).toEqual([]);
  });
});

describe("findRootBisection", () => {
  it("finds the root of a simple linear function", () => {
    // f(x) = x - 5, root at x = 5
    const result = findRootBisection((x) => x - 5, 0, 10);
    expect(result.found).toBe(true);
    if (result.found) expect(result.x).toBeCloseTo(5, 6);
  });

  it("finds the root of a non-linear function", () => {
    // f(x) = x^2 - 2, root at sqrt(2)
    const result = findRootBisection((x) => x * x - 2, 0, 2);
    expect(result.found).toBe(true);
    if (result.found) expect(result.x).toBeCloseTo(Math.sqrt(2), 6);
  });

  it("reports not found when there is no sign change in range", () => {
    // f(x) = x + 5 is positive across [0, 10]
    const result = findRootBisection((x) => x + 5, 0, 10);
    expect(result.found).toBe(false);
  });

  it("rejects lo >= hi", () => {
    expect(() => findRootBisection((x) => x, 10, 0)).toThrow(/lo must be < hi/);
  });
});

describe("solveBreakEvenForVariable", () => {
  it("solves for x where two impact functions cross", () => {
    // A(x) = 10 + 0.01x, B(x) = 0.05x -> cross at x = 10 / 0.04 = 250
    const result = solveBreakEvenForVariable((x) => 10 + 0.01 * x, (x) => 0.05 * x, 0, 1000);
    expect(result.found).toBe(true);
    if (result.found) expect(result.x).toBeCloseTo(250, 4);
  });

  it("reports not found when the functions never cross in range", () => {
    const result = solveBreakEvenForVariable((x) => 100 + x, (x) => x, 0, 10);
    expect(result.found).toBe(false);
  });
});
