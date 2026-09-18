import { describe, expect, it } from "vitest";
import { validateDecision } from "@/lib/decision/validate";
import { makeDecision, makeOption } from "./fixtures";

describe("validateDecision", () => {
  it("accepts a valid decision with PET options", () => {
    const decision = makeDecision([makeOption({ id: "a" }), makeOption({ id: "b" })]);
    expect(validateDecision(decision)).toEqual({ valid: true, errors: {} });
  });

  it("accepts a material with no recycled-content factor (e.g. PAPERBOARD) at recycledContentPct 0", () => {
    const decision = makeDecision([
      makeOption({ id: "a", materialCode: "PAPERBOARD", recycledContentPct: 0 }),
      makeOption({ id: "b" }),
    ]);
    expect(validateDecision(decision)).toEqual({ valid: true, errors: {} });
  });

  it("accepts a material with no recycled-content factor (e.g. PP) at recycledContentPct 0", () => {
    const decision = makeDecision([
      makeOption({ id: "a", materialCode: "PP", recycledContentPct: 0 }),
      makeOption({ id: "b" }),
    ]);
    expect(validateDecision(decision)).toEqual({ valid: true, errors: {} });
  });

  it("rejects a nonzero recycledContentPct for a material with no recycled-content factor", () => {
    const decision = makeDecision([
      makeOption({ id: "a", materialCode: "PAPERBOARD", recycledContentPct: 30 }),
      makeOption({ id: "b" }),
    ]);
    const result = validateDecision(decision);
    expect(result.valid).toBe(false);
    expect(result.errors["options.0.recycledContentPct"]).toMatch(
      /no verified recycled-content factor/,
    );
  });

  it("accepts a nonzero recycledContentPct for a material that does have a recycled-content factor", () => {
    const decision = makeDecision([
      makeOption({ id: "a", materialCode: "PET", recycledContentPct: 30 }),
      makeOption({ id: "b" }),
    ]);
    expect(validateDecision(decision)).toEqual({ valid: true, errors: {} });
  });
});
