/**
 * Deterministic sensitivity analysis: one-variable-at-a-time tornado data,
 * plus a numerical root finder used only when a break-even relationship
 * isn't linear enough to solve analytically (methodology §9). The reusable
 * break-even itself (N*) has a closed form — see engine.calculateBreakEven.
 */

export interface SensitivityVariable {
  name: string;
  low: number;
  central: number;
  high: number;
}

export interface SensitivityResult {
  name: string;
  impactAtLow: number;
  impactAtHigh: number;
  /** |impactAtHigh - impactAtLow| — used to rank variables, tornado-chart style. */
  swing: number;
}

/**
 * Varies each variable across [low, high] one at a time, holding all others
 * at their central value, and ranks the resulting impact swings descending.
 */
export function oneAtATimeSensitivity(
  variables: SensitivityVariable[],
  impactFn: (values: Record<string, number>) => number,
): SensitivityResult[] {
  if (variables.length === 0) return [];
  const centralValues: Record<string, number> = {};
  for (const v of variables) centralValues[v.name] = v.central;

  const results = variables.map((v) => {
    const impactAtLow = impactFn({ ...centralValues, [v.name]: v.low });
    const impactAtHigh = impactFn({ ...centralValues, [v.name]: v.high });
    return {
      name: v.name,
      impactAtLow,
      impactAtHigh,
      swing: Math.abs(impactAtHigh - impactAtLow),
    };
  });

  return results.sort((a, b) => b.swing - a.swing);
}

export type RootFindResult =
  | { found: true; x: number; iterations: number }
  | { found: false; reason: string };

/**
 * Deterministic bisection root finder for fn(x) = 0 over [lo, hi]. Requires a
 * sign change across the interval (fn(lo) and fn(hi) on opposite sides of
 * zero); otherwise reports that no root was found in range rather than
 * guessing. Used for break-even relationships that aren't linear in the
 * target variable (e.g., effective-cycles-driven feasibility thresholds).
 */
export function findRootBisection(
  fn: (x: number) => number,
  lo: number,
  hi: number,
  options: { tolerance?: number; maxIterations?: number } = {},
): RootFindResult {
  if (lo >= hi) throw new Error("lo must be < hi");
  const tolerance = options.tolerance ?? 1e-9;
  const maxIterations = options.maxIterations ?? 200;

  let a = lo;
  let b = hi;
  let fa = fn(a);
  const fb = fn(b);

  if (fa === 0) return { found: true, x: a, iterations: 0 };
  if (fb === 0) return { found: true, x: b, iterations: 0 };
  if ((fa > 0) === (fb > 0)) {
    return {
      found: false,
      reason: "No sign change across [lo, hi] — fn(lo) and fn(hi) are on the same side of zero.",
    };
  }

  for (let i = 0; i < maxIterations; i++) {
    const mid = (a + b) / 2;
    const fMid = fn(mid);
    if (Math.abs(fMid) < tolerance || (b - a) / 2 < tolerance) {
      return { found: true, x: mid, iterations: i + 1 };
    }
    if ((fMid > 0) === (fa > 0)) {
      a = mid;
      fa = fMid;
    } else {
      b = mid;
    }
  }
  return { found: true, x: (a + b) / 2, iterations: maxIterations };
}

/**
 * Solves for the value of x at which two impact functions are equal
 * (impactAFn(x) === impactBFn(x)), via bisection on their difference. Use
 * only when no closed-form solution is available for the relationship.
 */
export function solveBreakEvenForVariable(
  impactAFn: (x: number) => number,
  impactBFn: (x: number) => number,
  lo: number,
  hi: number,
  options?: { tolerance?: number; maxIterations?: number },
): RootFindResult {
  return findRootBisection((x) => impactAFn(x) - impactBFn(x), lo, hi, options);
}
