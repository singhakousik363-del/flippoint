import { TRANSPORT_CATALOG } from "@/lib/data/catalog";
import type { Decision } from "@/types/decision";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Shared identity for the seeded demo scenario, so any UI that wants to
 *  recognize "the user is looking at the demo" checks against one constant
 *  instead of duplicating this string. */
export const DEMO_DECISION_NAME = "Demo: Cold cup packaging";

/**
 * Seeded demo scenario for Phase E's signature "what would change my
 * decision?" experience. Every input here is a plain user-facing value
 * (mass, distance, recycled content) that runs through the same real engine
 * as manually entered data — nothing here is a hard-coded result number.
 * Both options use only verified emission factors (virgin/30%-recycled PET,
 * landfill disposal, road-freight transport).
 *
 * This lives outside the zustand store (a pure data/no-persistence module)
 * so build-time server code — e.g. the landing page's decision-flip preview —
 * can import it and run it through the engine without pulling in
 * client-only persistence machinery.
 */
export function createDemoDecision(): Decision {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: DEMO_DECISION_NAME,
    businessContext:
      "Seeded demo scenario — a close head-to-head between a heavier recycled-content cup " +
      "sourced nearby and a lighter virgin cup shipped farther. Try Sensitivity and What-If below.",
    annualVolume: 26000,
    options: [
      {
        id: newId(),
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
        id: newId(),
        name: "Lightweight virgin PET cup",
        materialCode: "PET",
        massGrams: 12,
        recycledContentPct: 0,
        transportFactorId: TRANSPORT_CATALOG[0].factorId,
        transportDistanceKm: 400,
        disposalPathway: "landfill",
        reusable: false,
        reusableSettings: null,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}
