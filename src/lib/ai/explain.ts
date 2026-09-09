import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient } from "@/lib/ai/client";
import {
  aiExplainRequestSchema,
  aiExplainResponseSchema,
  type AiExplainRequest,
  type AiExplainResponse,
} from "@/lib/ai/schema";

const SYSTEM_PROMPT = `You are an environmental decision explanation assistant.
You do not perform calculations.
You do not infer missing facts.
You do not invent numbers or sources.
You only explain validated deterministic results supplied to you.
When uncertainty is high, communicate uncertainty clearly.
Never use statistical significance language.

Rules:
- Every number you write must be copied verbatim from the data given to you below. Never compute, round, convert, combine, or derive a new number (no percentages, differences, multipliers, or totals you calculate yourself).
- Never invent an emission factor, a source name, a break-even value, or a confidence level. Only restate what is given.
- The confidence tier and the recommended (best) option are fixed by the data — never override, second-guess, or contradict them.
- If a field (break-even, scenario, sensitivity) is absent from the data, do not speculate about it or claim it doesn't matter.
- This is a modeled estimate, not a certified Life Cycle Assessment — keep the tone measured and factual, never authoritative-sounding beyond what the data supports.
- Return each key reason as its own array item, without your own numbering or bullet characters.`;

export interface ExplainResult {
  source: "ai" | "fallback";
  data: AiExplainResponse;
  /** Present only for "fallback" — an internal diagnostic, safe to log but not required in the UI. */
  reason?: string;
}

function line(label: string, value: string | undefined): string {
  return value ? `${label}: ${value}\n` : "";
}

function buildUserPrompt(input: AiExplainRequest): string {
  const optionLines = input.options
    .map((o) => {
      const parts = [
        `- ${o.name}${o.isBest ? " (current best)" : ""}${o.isReusable ? " [reusable]" : ""}`,
        `per-unit impact ${o.perUnitImpactDisplay}`,
        `annual impact ${o.annualImpactDisplay}`,
        `confidence ${o.confidence}`,
      ];
      if (o.productionDisplay) parts.push(`production ${o.productionDisplay}`);
      if (o.transportDisplay) parts.push(`transport ${o.transportDisplay}`);
      if (o.disposalDisplay) parts.push(`disposal ${o.disposalDisplay}`);
      if (o.flags.length) parts.push(`flags: ${o.flags.join("; ")}`);
      return parts.join(", ");
    })
    .join("\n");

  const sensitivityLines = input.topSensitivityVariables?.length
    ? input.topSensitivityVariables
        .map(
          (v, i) =>
            `${i + 1}. ${v.label} — swing ${v.swingDisplay}${v.flipsWithinProbe ? " (could flip the recommendation)" : ""}`,
        )
        .join("\n")
    : undefined;

  return [
    `Decision: ${input.decisionName}`,
    line("Business context", input.businessContext),
    line("Annual volume", input.annualVolumeDisplay),
    "",
    "Options compared:",
    optionLines,
    "",
    `Best option (deterministic recommendation): ${input.bestOptionName}`,
    line("Runner-up", input.runnerUpOptionName),
    input.mostSensitiveVariable
      ? `Most sensitive variable: ${input.mostSensitiveVariable.label} (swing ${input.mostSensitiveVariable.swingDisplay}; could flip recommendation: ${input.mostSensitiveVariable.flipsWithinProbe})`
      : "",
    sensitivityLines ? `\nTop sensitivity ranking:\n${sensitivityLines}` : "",
    input.breakEven
      ? `\nBreak-even for ${input.breakEven.variableLabel}: current ${input.breakEven.currentDisplay}${
          input.breakEven.solvable
            ? `, break-even at ${input.breakEven.breakEvenDisplay} (below: ${input.breakEven.belowOptionName} wins, above: ${input.breakEven.aboveOptionName} wins)`
            : `, no solvable break-even — ${input.breakEven.reason}`
        }`
      : "",
    input.scenario
      ? `\nWhat-if scenario applied: ${input.scenario.changedFieldsDisplay.join("; ")} -> scenario winner ${input.scenario.scenarioWinnerName}, impact delta ${input.scenario.deltaDisplay}, flips recommendation: ${input.scenario.flips}`
      : "",
    input.sources?.length
      ? `\nSourced factors behind these numbers: ${input.sources.map((s) => `${s.material} (${s.sourceName})`).join("; ")}`
      : "",
    "",
    "Write a short decision brief using only the facts and numbers above.",
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeNumber(raw: string): string {
  const n = Number(raw);
  return Number.isNaN(n) ? raw : n.toString();
}

function extractNumbers(text: string): string[] {
  const matches = text.match(/-?\d+(?:\.\d+)?/g) ?? [];
  return matches.map(normalizeNumber);
}

/** Every number the AI is allowed to use is one already present in the
 *  pre-formatted display strings we supplied — nothing is derived here. */
function collectAllowedNumbers(input: AiExplainRequest): Set<string> {
  const strings: (string | undefined)[] = [
    input.decisionName,
    input.businessContext,
    input.annualVolumeDisplay,
    input.bestOptionName,
    input.runnerUpOptionName,
    input.mostSensitiveVariable?.label,
    input.mostSensitiveVariable?.swingDisplay,
    input.breakEven?.variableLabel,
    input.breakEven?.currentDisplay,
    input.breakEven?.breakEvenDisplay,
    input.breakEven?.belowOptionName,
    input.breakEven?.aboveOptionName,
    input.breakEven?.reason,
    input.scenario?.scenarioWinnerName,
    input.scenario?.deltaDisplay,
    String(input.options.length),
  ];
  for (const o of input.options) {
    strings.push(o.name, o.perUnitImpactDisplay, o.annualImpactDisplay, o.productionDisplay, o.transportDisplay, o.disposalDisplay);
    strings.push(...o.flags);
  }
  input.topSensitivityVariables?.forEach((v) => strings.push(v.label, v.swingDisplay));
  input.scenario?.changedFieldsDisplay.forEach((f) => strings.push(f));
  input.sources?.forEach((s) => strings.push(s.material, s.sourceName));

  const allowed = new Set<string>();
  for (const s of strings) {
    if (!s) continue;
    for (const n of extractNumbers(s)) allowed.add(n);
  }
  return allowed;
}

function verifyNoFabricatedNumbers(
  response: AiExplainResponse,
  allowed: Set<string>,
): { ok: boolean; badNumbers: string[] } {
  const allText = [response.headline, response.summary, ...response.keyReasons, response.caution ?? "", response.action ?? ""].join(
    "\n",
  );
  const found = extractNumbers(allText);
  const bad = Array.from(new Set(found.filter((n) => !allowed.has(n))));
  return { ok: bad.length === 0, badNumbers: bad };
}

/** Deterministic, AI-free fallback — always available, built only from the
 *  same validated input the AI would have received. */
export function buildFallback(input: AiExplainRequest): AiExplainResponse {
  const best = input.options.find((o) => o.isBest) ?? input.options[0];
  const keyReasons: string[] = [
    `${best.name} has the lowest modeled per-unit impact (${best.perUnitImpactDisplay}) among the options compared.`,
  ];
  if (input.mostSensitiveVariable) {
    keyReasons.push(
      `${input.mostSensitiveVariable.label} is the assumption with the largest effect on this comparison (swing of ${input.mostSensitiveVariable.swingDisplay}).`,
    );
  }
  const flagNote = best.flags.length ? ` Note: ${best.flags.join("; ")}.` : "";

  return {
    headline: `${best.name} currently ranks best.`,
    summary: `Based on the deterministic calculation engine, ${best.name} has the lower modeled impact (${best.perUnitImpactDisplay} per unit, ${best.annualImpactDisplay} annually) at ${best.confidence} confidence.${flagNote}`,
    keyReasons,
    caution:
      input.mostSensitiveVariable?.flipsWithinProbe
        ? `This conclusion is sensitive to ${input.mostSensitiveVariable.label} — a plausible change there could change the recommendation.`
        : undefined,
    action: undefined,
  };
}

/**
 * Validates the request, calls Claude for a natural-language explanation of
 * already-computed results, verifies no number in the response was
 * fabricated, and always returns a safe, schema-valid result — falling back
 * to a deterministic template (never a broken UI) on any failure.
 */
export async function generateDecisionBrief(
  rawInput: unknown,
): Promise<{ ok: true; result: ExplainResult } | { ok: false; error: string }> {
  const parsed = aiExplainRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: `Invalid request payload: ${parsed.error.message}` };
  }
  const input = parsed.data;
  const fallback = buildFallback(input);

  try {
    const client = getAnthropicClient();
    const message = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 1024,
      // Formatting already-computed data into prose doesn't need deep reasoning;
      // disabled thinking + low effort keeps this fast. Safe here because we
      // aren't using tools (the failure modes of disabled thinking are tool-call-
      // specific — see claude-api skill).
      thinking: { type: "disabled" },
      output_config: { effort: "low", format: zodOutputFormat(aiExplainResponseSchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    });

    if (message.stop_reason === "refusal") {
      return { ok: true, result: { source: "fallback", data: fallback, reason: "AI declined to respond." } };
    }

    const parsedOutput = message.parsed_output;
    if (!parsedOutput) {
      return { ok: true, result: { source: "fallback", data: fallback, reason: "AI response was empty or malformed." } };
    }

    const allowed = collectAllowedNumbers(input);
    const check = verifyNoFabricatedNumbers(parsedOutput, allowed);
    if (!check.ok) {
      return {
        ok: true,
        result: {
          source: "fallback",
          data: fallback,
          reason: `AI response referenced unverified numbers: ${check.badNumbers.join(", ")}`,
        },
      };
    }

    return { ok: true, result: { source: "ai", data: parsedOutput } };
  } catch (e) {
    // Log the real cause server-side only — never surface raw SDK/error text
    // (which can include request internals) to the client.
    console.error("[ai/explain] AI call failed, using fallback:", e);
    return { ok: true, result: { source: "fallback", data: fallback, reason: "AI service unavailable." } };
  }
}
