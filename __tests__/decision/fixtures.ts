import type { Decision, PackagingOptionDraft, ReusableSettingsDraft } from "@/types/decision";

let counter = 0;
function id(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function makeReusableSettings(
  overrides: Partial<ReusableSettingsDraft> = {},
): ReusableSettingsDraft {
  return {
    maxCycles: 500,
    lossRatePct: 2,
    itemsPerWash: 24,
    returnTransportPerUseKgCo2e: 0,
    ...overrides,
  };
}

export function makeOption(overrides: Partial<PackagingOptionDraft> = {}): PackagingOptionDraft {
  return {
    id: id("option"),
    name: "Option",
    materialCode: "PET",
    massGrams: 12,
    recycledContentPct: 0,
    transportFactorId: "road-freight-hgv-average",
    transportDistanceKm: 400,
    disposalPathway: "landfill",
    reusable: false,
    reusableSettings: null,
    ...overrides,
  };
}

export function makeDecision(options: PackagingOptionDraft[], overrides: Partial<Decision> = {}): Decision {
  const now = new Date().toISOString();
  return {
    id: id("decision"),
    name: "Test decision",
    businessContext: "",
    annualVolume: 26000,
    options,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
