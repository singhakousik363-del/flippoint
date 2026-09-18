import { z } from "zod";
import { validateDecision } from "@/lib/decision/validate";
import type { Decision, PackagingOptionDraft } from "@/types/decision";

/** Query parameter a shareable workspace URL carries its encoded decision in. */
export const SHARE_PARAM = "share";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Encoded as tuples (not keyed objects) to keep the URL short — field names
// cost bytes that positional arrays don't. Only user-entered inputs are
// encoded here; id/createdAt/updatedAt are regenerated on decode, and no
// computed result ever goes into the link.
type ReusableSettingsTuple = [
  maxCycles: number,
  lossRatePct: number,
  itemsPerWash: number,
  returnTransportPerUseKgCo2e: number,
];

type OptionTuple = [
  name: string,
  materialCode: string,
  massGrams: number,
  recycledContentPct: number,
  transportFactorId: string,
  transportDistanceKm: number | null,
  disposalPathway: string,
  reusable: boolean,
  reusableSettings: ReusableSettingsTuple | null,
];

type DecisionTuple = [
  name: string,
  businessContext: string,
  annualVolume: number,
  options: OptionTuple[],
];

const reusableSettingsTupleSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

const optionTupleSchema = z.tuple([
  z.string(),
  z.string(),
  z.number(),
  z.number(),
  z.string(),
  z.number().nullable(),
  z.string(),
  z.boolean(),
  z.union([reusableSettingsTupleSchema, z.null()]),
]);

const decisionTupleSchema = z.tuple([
  z.string(),
  z.string(),
  z.number(),
  z.array(optionTupleSchema).max(4),
]);

function optionToTuple(option: PackagingOptionDraft): OptionTuple {
  return [
    option.name,
    option.materialCode,
    option.massGrams,
    option.recycledContentPct,
    option.transportFactorId,
    option.transportDistanceKm,
    option.disposalPathway,
    option.reusable,
    option.reusableSettings
      ? [
          option.reusableSettings.maxCycles,
          option.reusableSettings.lossRatePct,
          option.reusableSettings.itemsPerWash,
          option.reusableSettings.returnTransportPerUseKgCo2e,
        ]
      : null,
  ];
}

function tupleToOption(tuple: OptionTuple): PackagingOptionDraft {
  const [
    name,
    materialCode,
    massGrams,
    recycledContentPct,
    transportFactorId,
    transportDistanceKm,
    disposalPathway,
    reusable,
    reusableSettings,
  ] = tuple;
  return {
    id: newId(),
    name,
    materialCode: materialCode as PackagingOptionDraft["materialCode"],
    massGrams,
    recycledContentPct,
    transportFactorId,
    transportDistanceKm,
    disposalPathway: disposalPathway as PackagingOptionDraft["disposalPathway"],
    reusable,
    reusableSettings: reusableSettings
      ? {
          maxCycles: reusableSettings[0],
          lossRatePct: reusableSettings[1],
          itemsPerWash: reusableSettings[2],
          returnTransportPerUseKgCo2e: reusableSettings[3],
        }
      : null,
  };
}

function decisionToTuple(decision: Decision): DecisionTuple {
  return [decision.name, decision.businessContext, decision.annualVolume, decision.options.map(optionToTuple)];
}

function tupleToDecision(tuple: DecisionTuple): Decision {
  const [name, businessContext, annualVolume, options] = tuple;
  const now = new Date().toISOString();
  return {
    id: newId(),
    name,
    businessContext,
    annualVolume,
    options: options.map(tupleToOption),
    createdAt: now,
    updatedAt: now,
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): Uint8Array | null {
  // Reject anything outside the base64url alphabet up front so a hostile
  // string can't reach atob() with unexpected characters.
  if (!/^[A-Za-z0-9_-]*$/.test(input)) return null;
  try {
    const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** Encodes a decision's user inputs (never computed results) into a compact,
 *  URL-safe string suitable for a query parameter. */
export function encodeDecisionToShareParam(decision: Decision): string {
  const json = JSON.stringify(decisionToTuple(decision));
  return toBase64Url(new TextEncoder().encode(json));
}

/** Decodes a share-link query parameter back into a full `Decision`, or
 *  `null` if the input is malformed, structurally wrong, or fails the same
 *  `validateDecision` schema normal decisions are held to. Never throws —
 *  callers should fall back to normal behaviour (e.g. localStorage) on `null`. */
export function decodeShareParam(param: string): Decision | null {
  try {
    const bytes = fromBase64Url(param);
    if (!bytes) return null;
    const json = new TextDecoder().decode(bytes);
    const parsed: unknown = JSON.parse(json);
    const result = decisionTupleSchema.safeParse(parsed);
    if (!result.success) return null;

    const decision = tupleToDecision(result.data);
    const { valid } = validateDecision(decision);
    return valid ? decision : null;
  } catch {
    return null;
  }
}

/** Builds the full shareable URL for a decision, pointing at the current
 *  page. Client-only — reads `window.location`. */
export function buildShareUrl(decision: Decision): string {
  const encoded = encodeDecisionToShareParam(decision);
  const params = new URLSearchParams({ [SHARE_PARAM]: encoded });
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}
