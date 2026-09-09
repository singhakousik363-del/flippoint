/**
 * UI-facing catalog of what the verified emission-factor dataset actually
 * supports. This file introduces no new scientific values — it only groups
 * existing verified factor ids (see emission-factors.json) so the Decision
 * Builder can only offer choices the engine can compute. Materials/pathways
 * without a verified factor (PLA, recycled PP, PP recycling — see
 * pending-factors.ts) are intentionally absent.
 */
import type { DisposalPathway } from "@/types/domain";
import type { MaterialCode } from "@/types/decision";

export interface DisposalOption {
  pathway: DisposalPathway;
  factorId: string;
  label: string;
}

export interface MaterialCatalogEntry {
  code: MaterialCode;
  label: string;
  virginFactorId: string;
  /** Present only when a verified 100%-recycled-content factor exists for this material. */
  recycledFactorId?: string;
  disposalOptions: DisposalOption[];
}

export const MATERIAL_CATALOG: MaterialCatalogEntry[] = [
  {
    code: "PET",
    label: "PET (polyethylene terephthalate)",
    virginFactorId: "virgin-pet-production",
    recycledFactorId: "recycled-pet-production",
    disposalOptions: [
      { pathway: "landfill", factorId: "pet-landfill", label: "Landfill" },
      { pathway: "combustion", factorId: "pet-combustion", label: "Combustion (waste-to-energy)" },
      { pathway: "recycling", factorId: "pet-recycling-credit", label: "Recycling" },
    ],
  },
  {
    code: "HDPE",
    label: "HDPE (high-density polyethylene)",
    virginFactorId: "virgin-hdpe-production",
    recycledFactorId: "recycled-hdpe-production",
    disposalOptions: [
      { pathway: "landfill", factorId: "hdpe-landfill", label: "Landfill" },
      { pathway: "combustion", factorId: "hdpe-combustion", label: "Combustion (waste-to-energy)" },
      { pathway: "recycling", factorId: "hdpe-recycling-credit", label: "Recycling" },
    ],
  },
  {
    code: "PP",
    label: "PP (polypropylene)",
    virginFactorId: "virgin-pp-production",
    // No recycledFactorId: no verified recycled-PP production factor (pending).
    disposalOptions: [
      { pathway: "landfill", factorId: "pp-landfill", label: "Landfill" },
      { pathway: "combustion", factorId: "pp-combustion", label: "Combustion (waste-to-energy)" },
      // No "recycling" option: no verified PP recycling factor (pending).
    ],
  },
];

export const TRANSPORT_CATALOG: { factorId: string; label: string }[] = [
  { factorId: "road-freight-hgv-average", label: "Road freight (HGV, average laden)" },
];

export const REUSE_WASHING_FACTOR_ID = "commercial-dishwasher-washing-energy";
export const GRID_FACTOR_ID = "us-grid-electricity-average";

export function getMaterial(code: MaterialCode): MaterialCatalogEntry {
  const entry = MATERIAL_CATALOG.find((m) => m.code === code);
  if (!entry) throw new Error(`Unknown material code "${code}"`);
  return entry;
}

export function getDisposalOptionsFor(code: MaterialCode): DisposalOption[] {
  return getMaterial(code).disposalOptions;
}
