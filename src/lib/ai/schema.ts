import { z } from "zod";

/**
 * Strict input contract for the AI explanation endpoint. Every field here is
 * a pre-formatted, human-readable projection of numbers the deterministic
 * engine already computed — the AI never receives raw kg values to do its
 * own math on, only display strings it must copy verbatim.
 */
export const aiOptionSummarySchema = z.object({
  name: z.string().min(1).max(200),
  isBest: z.boolean(),
  isReusable: z.boolean(),
  perUnitImpactDisplay: z.string().min(1).max(60),
  annualImpactDisplay: z.string().min(1).max(60),
  confidence: z.enum(["high", "medium", "low"]),
  productionDisplay: z.string().max(60).optional(),
  transportDisplay: z.string().max(60).optional(),
  disposalDisplay: z.string().max(60).optional(),
  flags: z.array(z.string().max(120)).max(10),
});

export const aiSensitivityVariableSchema = z.object({
  label: z.string().min(1).max(150),
  swingDisplay: z.string().min(1).max(60),
  flipsWithinProbe: z.boolean(),
});

export const aiBreakEvenSchema = z.object({
  variableLabel: z.string().min(1).max(150),
  currentDisplay: z.string().min(1).max(60),
  solvable: z.boolean(),
  breakEvenDisplay: z.string().max(60).optional(),
  belowOptionName: z.string().max(200).optional(),
  aboveOptionName: z.string().max(200).optional(),
  reason: z.string().max(300).optional(),
});

export const aiScenarioSchema = z.object({
  changedFieldsDisplay: z.array(z.string().max(120)).max(10),
  scenarioWinnerName: z.string().min(1).max(200),
  flips: z.boolean(),
  deltaDisplay: z.string().min(1).max(60),
});

export const aiSourceSchema = z.object({
  material: z.string().min(1).max(200),
  sourceName: z.string().min(1).max(300),
});

export const aiExplainRequestSchema = z.object({
  decisionName: z.string().min(1).max(200),
  businessContext: z.string().max(2000).optional(),
  annualVolumeDisplay: z.string().max(100).optional(),
  options: z.array(aiOptionSummarySchema).min(2).max(4),
  bestOptionName: z.string().min(1).max(200),
  runnerUpOptionName: z.string().max(200).optional(),
  mostSensitiveVariable: aiSensitivityVariableSchema.optional(),
  topSensitivityVariables: z.array(aiSensitivityVariableSchema).max(5).optional(),
  breakEven: aiBreakEvenSchema.optional(),
  scenario: aiScenarioSchema.optional(),
  sources: z.array(aiSourceSchema).max(20).optional(),
});

export type AiExplainRequest = z.infer<typeof aiExplainRequestSchema>;

/**
 * Strict output contract. No field here is a number type — every number the
 * model wants to state must appear as a substring of one of these strings,
 * and is verified against the input's own display strings before use (see
 * lib/ai/explain.ts). Nothing here overrides the deterministic recommendation.
 */
export const aiExplainResponseSchema = z.object({
  headline: z.string().min(1).max(140),
  summary: z.string().min(1).max(600),
  keyReasons: z.array(z.string().min(1).max(200)).min(1).max(5),
  caution: z.string().max(400).optional(),
  action: z.string().max(200).optional(),
});

export type AiExplainResponse = z.infer<typeof aiExplainResponseSchema>;
