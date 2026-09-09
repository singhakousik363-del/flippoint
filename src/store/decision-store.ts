import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { TRANSPORT_CATALOG } from "@/lib/data/catalog";
import type { Decision, PackagingOptionDraft } from "@/types/decision";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createEmptyOption(name: string): PackagingOptionDraft {
  return {
    id: newId(),
    name,
    materialCode: "PET",
    massGrams: 0,
    recycledContentPct: 0,
    transportFactorId: TRANSPORT_CATALOG[0].factorId,
    transportDistanceKm: null,
    disposalPathway: "landfill",
    reusable: false,
    reusableSettings: null,
  };
}

function createDefaultDecision(): Decision {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: "",
    businessContext: "",
    annualVolume: 0,
    options: [createEmptyOption("Option A"), createEmptyOption("Option B")],
    createdAt: now,
    updatedAt: now,
  };
}

/** Shared identity for the seeded demo scenario, so any UI that wants to
 *  recognize "the user is looking at the demo" checks against one constant
 *  instead of duplicating this string. */
export const DEMO_DECISION_NAME = "Demo: Cold cup packaging";

function defaultReusableSettings() {
  return { maxCycles: 500, lossRatePct: 2, itemsPerWash: 24, returnTransportPerUseKgCo2e: 0 };
}

/**
 * Seeded demo scenario for Phase E's signature "what would change my
 * decision?" experience. Every input here is a plain user-facing value
 * (mass, distance, recycled content) that runs through the same real engine
 * as manually entered data — nothing here is a hard-coded result number.
 * Both options use only verified emission factors (virgin/30%-recycled PET,
 * landfill disposal, road-freight transport).
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

interface DecisionStoreState {
  decision: Decision;
  setName: (name: string) => void;
  setBusinessContext: (context: string) => void;
  setAnnualVolume: (volume: number) => void;
  addOption: () => void;
  removeOption: (optionId: string) => void;
  updateOption: (optionId: string, patch: Partial<PackagingOptionDraft>) => void;
  setReusable: (optionId: string, reusable: boolean) => void;
  resetDecision: () => void;
  loadDemo: () => void;
}

export const useDecisionStore = create<DecisionStoreState>()(
  persist(
    (set) => ({
      decision: createDefaultDecision(),

      setName: (name) =>
        set((s) => ({ decision: { ...s.decision, name, updatedAt: new Date().toISOString() } })),

      setBusinessContext: (businessContext) =>
        set((s) => ({
          decision: { ...s.decision, businessContext, updatedAt: new Date().toISOString() },
        })),

      setAnnualVolume: (annualVolume) =>
        set((s) => ({
          decision: { ...s.decision, annualVolume, updatedAt: new Date().toISOString() },
        })),

      addOption: () =>
        set((s) => {
          if (s.decision.options.length >= 4) return s;
          const label = String.fromCharCode(65 + s.decision.options.length); // A, B, C, D
          return {
            decision: {
              ...s.decision,
              options: [...s.decision.options, createEmptyOption(`Option ${label}`)],
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      removeOption: (optionId) =>
        set((s) => {
          if (s.decision.options.length <= 2) return s;
          return {
            decision: {
              ...s.decision,
              options: s.decision.options.filter((o) => o.id !== optionId),
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      updateOption: (optionId, patch) =>
        set((s) => ({
          decision: {
            ...s.decision,
            options: s.decision.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)),
            updatedAt: new Date().toISOString(),
          },
        })),

      setReusable: (optionId, reusable) =>
        set((s) => ({
          decision: {
            ...s.decision,
            options: s.decision.options.map((o) =>
              o.id === optionId
                ? { ...o, reusable, reusableSettings: reusable ? defaultReusableSettings() : null }
                : o,
            ),
            updatedAt: new Date().toISOString(),
          },
        })),

      resetDecision: () => set({ decision: createDefaultDecision() }),

      loadDemo: () => set({ decision: createDemoDecision() }),
    }),
    {
      name: "ecotrace-decision-draft",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ decision: state.decision }),
    },
  ),
);
