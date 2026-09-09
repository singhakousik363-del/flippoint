import { describe, expect, it } from "vitest";
import rawFactors from "@/lib/data/emission-factors.json";
import { emissionFactorSetSchema } from "@/lib/validation/emission-factor";
import { PENDING_FACTORS } from "@/lib/data/pending-factors";

describe("emission-factors.json", () => {
  it("validates against emissionFactorSetSchema", () => {
    const result = emissionFactorSetSchema.safeParse(rawFactors);
    expect(result.success).toBe(true);
  });

  it("has no duplicate ids", () => {
    const ids = (rawFactors as { id: string }[]).map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry has a non-empty source URL and calculation basis", () => {
    for (const f of rawFactors as { source: { url: string }; calculationBasis: string }[]) {
      expect(f.source.url.length).toBeGreaterThan(0);
      expect(f.calculationBasis.length).toBeGreaterThan(0);
    }
  });

  it("does not share any id with the documented pending-factor list", () => {
    const verifiedIds = new Set((rawFactors as { id: string }[]).map((f) => f.id));
    for (const pending of PENDING_FACTORS) {
      expect(verifiedIds.has(pending.id)).toBe(false);
    }
  });

  it("every pending factor has at least one candidate source documented", () => {
    for (const pending of PENDING_FACTORS) {
      expect(pending.candidateSources.length).toBeGreaterThan(0);
      expect(pending.reason.length).toBeGreaterThan(0);
    }
  });
});
