import { describe, expect, it } from "vitest";
import { decodeShareParam, encodeDecisionToShareParam } from "@/lib/decision/share-link";
import { TRANSPORT_CATALOG } from "@/lib/data/catalog";
import { validateDecision } from "@/lib/decision/validate";
import type { Decision } from "@/types/decision";

function buildDecision(): Decision {
  const now = new Date().toISOString();
  return {
    id: "original-id",
    name: "Cold cup packaging",
    businessContext: "Head-to-head between a recycled and a virgin cup.",
    annualVolume: 26000,
    options: [
      {
        id: "option-a",
        name: "Recycled-content PET cup",
        materialCode: "PET",
        massGrams: 16,
        recycledContentPct: 30,
        transportFactorId: TRANSPORT_CATALOG[0].factorId,
        transportDistanceKm: 200,
        disposalPathway: "landfill",
        reusable: false,
        reusableSettings: null,
      },
      {
        id: "option-b",
        name: "Reusable HDPE tote",
        materialCode: "HDPE",
        massGrams: 180,
        recycledContentPct: 0,
        transportFactorId: TRANSPORT_CATALOG[0].factorId,
        transportDistanceKm: 50,
        disposalPathway: "recycling",
        reusable: true,
        reusableSettings: {
          maxCycles: 500,
          lossRatePct: 2,
          itemsPerWash: 24,
          returnTransportPerUseKgCo2e: 0.05,
        },
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

describe("encodeDecisionToShareParam / decodeShareParam", () => {
  it("round-trips every user-input field", () => {
    const decision = buildDecision();
    const encoded = encodeDecisionToShareParam(decision);
    const decoded = decodeShareParam(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded!.name).toBe(decision.name);
    expect(decoded!.businessContext).toBe(decision.businessContext);
    expect(decoded!.annualVolume).toBe(decision.annualVolume);
    expect(decoded!.options).toHaveLength(decision.options.length);
    decoded!.options.forEach((option, i) => {
      const original = decision.options[i];
      expect(option.name).toBe(original.name);
      expect(option.materialCode).toBe(original.materialCode);
      expect(option.massGrams).toBe(original.massGrams);
      expect(option.recycledContentPct).toBe(original.recycledContentPct);
      expect(option.transportFactorId).toBe(original.transportFactorId);
      expect(option.transportDistanceKm).toBe(original.transportDistanceKm);
      expect(option.disposalPathway).toBe(original.disposalPathway);
      expect(option.reusable).toBe(original.reusable);
      expect(option.reusableSettings).toEqual(original.reusableSettings);
    });
  });

  it("regenerates id/createdAt/updatedAt rather than carrying the originals through", () => {
    const decision = buildDecision();
    const decoded = decodeShareParam(encodeDecisionToShareParam(decision));

    expect(decoded!.id).not.toBe(decision.id);
    expect(decoded!.options[0].id).not.toBe(decision.options[0].id);
  });

  it("produces a decision that itself passes validateDecision", () => {
    const decision = buildDecision();
    const decoded = decodeShareParam(encodeDecisionToShareParam(decision));

    expect(decoded).not.toBeNull();
    expect(validateDecision(decoded!).valid).toBe(true);
  });

  it("never encodes computed results — only the tuple's own inputs decode back out", () => {
    const decision = buildDecision();
    const encoded = encodeDecisionToShareParam(decision);
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)));
    // A computed field name (e.g. from DecisionResults) should never appear
    // in the payload — only raw user-input values.
    expect(json).not.toContain("bestOptionId");
    expect(json).not.toContain("perUnitImpact");
    expect(json).not.toContain("annualImpact");
  });

  it("produces a reasonably short parameter for a 4-option decision", () => {
    const decision = buildDecision();
    decision.options.push(
      { ...decision.options[0], id: "option-c", name: "Option C" },
      { ...decision.options[1], id: "option-d", name: "Option D" },
    );
    const encoded = encodeDecisionToShareParam(decision);
    expect(encoded.length).toBeLessThan(1000);
  });

  it("rejects a malformed base64url string without throwing", () => {
    expect(() => decodeShareParam("not-valid-base64!!!")).not.toThrow();
    expect(decodeShareParam("not-valid-base64!!!")).toBeNull();
  });

  it("rejects base64 that decodes to non-JSON garbage without throwing", () => {
    const garbage = btoa("this is not json").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(() => decodeShareParam(garbage)).not.toThrow();
    expect(decodeShareParam(garbage)).toBeNull();
  });

  it("rejects valid JSON that doesn't match the expected tuple shape", () => {
    const wrongShape = btoa(JSON.stringify({ hello: "world" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(decodeShareParam(wrongShape)).toBeNull();
  });

  it("rejects a structurally-valid tuple whose values fail domain validation", () => {
    // Negative mass, wrong disposal pathway — shape is right, values aren't.
    const tuple = ["Hostile decision", "", 1000, [
      ["Bad option", "PET", -50, 0, TRANSPORT_CATALOG[0].factorId, 100, "landfill", false, null],
    ]];
    const encoded = btoa(JSON.stringify(tuple)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeShareParam(encoded)).toBeNull();
  });

  it("rejects a tuple with only one option (schema requires at least two)", () => {
    const decision = buildDecision();
    decision.options = [decision.options[0]];
    const encoded = encodeDecisionToShareParam(decision);
    expect(decodeShareParam(encoded)).toBeNull();
  });

  it("rejects a tuple with more than four options", () => {
    const decision = buildDecision();
    for (let i = 0; i < 5; i++) {
      decision.options.push({ ...decision.options[0], id: `extra-${i}`, name: `Extra ${i}` });
    }
    const encoded = encodeDecisionToShareParam(decision);
    expect(decodeShareParam(encoded)).toBeNull();
  });

  it("rejects an unrecognized material code", () => {
    const tuple = [
      "Hostile decision",
      "",
      1000,
      [
        ["Bad option", "UNOBTAINIUM", 50, 0, TRANSPORT_CATALOG[0].factorId, 100, "landfill", false, null],
        ["Other option", "PET", 50, 0, TRANSPORT_CATALOG[0].factorId, 100, "landfill", false, null],
      ],
    ];
    const encoded = btoa(JSON.stringify(tuple)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeShareParam(encoded)).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(decodeShareParam("")).toBeNull();
  });

  it("rejects a string containing characters outside the base64url alphabet", () => {
    expect(decodeShareParam("<script>alert(1)</script>")).toBeNull();
  });

  it("never throws regardless of arbitrary hostile input", () => {
    const hostileInputs = [
      "null",
      "undefined",
      "{}",
      "[]",
      "0",
      "-1",
      "%00%00%00",
      "A".repeat(10000),
      JSON.stringify({ __proto__: { polluted: true } }),
    ];
    for (const input of hostileInputs) {
      expect(() => decodeShareParam(input)).not.toThrow();
    }
  });
});
