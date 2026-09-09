import { beforeEach, describe, expect, it, vi } from "vitest";

const parseMock = vi.fn();

vi.mock("@/lib/ai/client", () => ({
  getAnthropicClient: () => ({
    messages: { parse: parseMock },
  }),
}));

const { generateDecisionBrief, buildFallback } = await import("@/lib/ai/explain");
const { aiExplainResponseSchema } = await import("@/lib/ai/schema");
type AiExplainRequest = import("@/lib/ai/schema").AiExplainRequest;

function validRequest(overrides: Partial<AiExplainRequest> = {}): AiExplainRequest {
  return {
    decisionName: "Coffee cup packaging",
    annualVolumeDisplay: "100,000 units/year",
    options: [
      {
        name: "Recycled PET cup",
        isBest: true,
        isReusable: false,
        perUnitImpactDisplay: "0.05 kg CO2e",
        annualImpactDisplay: "5,000 kg CO2e",
        confidence: "high",
        flags: [],
      },
      {
        name: "Virgin plastic cup",
        isBest: false,
        isReusable: false,
        perUnitImpactDisplay: "0.09 kg CO2e",
        annualImpactDisplay: "9,000 kg CO2e",
        confidence: "high",
        flags: [],
      },
    ],
    bestOptionName: "Recycled PET cup",
    ...overrides,
  };
}

beforeEach(() => {
  parseMock.mockReset();
});

describe("generateDecisionBrief — request validation", () => {
  it("rejects a request missing required fields", async () => {
    const outcome = await generateDecisionBrief({ decisionName: "Missing everything else" });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toMatch(/Invalid request payload/);
    }
    expect(parseMock).not.toHaveBeenCalled();
  });

  it("rejects a request with fewer than two options", async () => {
    const bad = validRequest();
    bad.options = [bad.options[0]];
    const outcome = await generateDecisionBrief(bad);
    expect(outcome.ok).toBe(false);
  });
});

describe("generateDecisionBrief — malformed AI output", () => {
  it("falls back when parsed_output is missing", async () => {
    parseMock.mockResolvedValue({ stop_reason: "end_turn", parsed_output: null });
    const outcome = await generateDecisionBrief(validRequest());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.source).toBe("fallback");
      expect(outcome.result.reason).toMatch(/empty or malformed/);
    }
  });

  it("falls back when the model refuses to respond", async () => {
    parseMock.mockResolvedValue({ stop_reason: "refusal", parsed_output: null });
    const outcome = await generateDecisionBrief(validRequest());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.source).toBe("fallback");
      expect(outcome.result.reason).toMatch(/declined/);
    }
  });

  it("falls back when the AI invents a number not present anywhere in the input", async () => {
    parseMock.mockResolvedValue({
      stop_reason: "end_turn",
      parsed_output: {
        headline: "Recycled PET cup wins",
        summary: "It saves 42 kg CO2e per unit, which is a fabricated figure.",
        keyReasons: ["Lower modeled impact"],
      },
    });
    const outcome = await generateDecisionBrief(validRequest());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.source).toBe("fallback");
      expect(outcome.result.reason).toMatch(/unverified numbers/);
      expect(outcome.result.reason).toContain("42");
    }
  });
});

describe("generateDecisionBrief — API failure", () => {
  it("falls back when the Anthropic call throws", async () => {
    parseMock.mockRejectedValue(new Error("network timeout"));
    const outcome = await generateDecisionBrief(validRequest());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.source).toBe("fallback");
      expect(outcome.result.reason).toMatch(/AI service unavailable/);
    }
  });

  it("never lets the raw SDK error text leak into the client-facing result", async () => {
    parseMock.mockRejectedValue(new Error("secret internal request id 12345"));
    const outcome = await generateDecisionBrief(validRequest());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(JSON.stringify(outcome.result)).not.toContain("secret internal request id");
    }
  });
});

describe("generateDecisionBrief — preservation of deterministic values", () => {
  it("keeps the deterministic best option and figures verbatim in the fallback, regardless of AI availability", async () => {
    parseMock.mockRejectedValue(new Error("unavailable"));
    const request = validRequest();
    const outcome = await generateDecisionBrief(request);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      const { data } = outcome.result;
      expect(data.headline).toContain("Recycled PET cup");
      expect(data.summary).toContain("0.05 kg CO2e");
      expect(data.summary).toContain("5,000 kg CO2e");
      expect(data.summary).not.toContain("Virgin plastic cup");
    }
  });

  it("buildFallback never changes which option is declared best", () => {
    const request = validRequest();
    const fallback = buildFallback(request);
    expect(fallback.headline).toContain(request.bestOptionName);
  });

  it("passes through a well-formed AI response that only cites supplied numbers, without altering the deterministic recommendation", async () => {
    const goodResponse = {
      headline: "Recycled PET cup is the lower-impact choice",
      summary: "At 0.05 kg CO2e per unit versus 0.09 kg CO2e, the recycled option has less modeled impact.",
      keyReasons: ["Lower per-unit impact at high confidence"],
    };
    parseMock.mockResolvedValue({ stop_reason: "end_turn", parsed_output: goodResponse });
    const request = validRequest();
    const outcome = await generateDecisionBrief(request);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.source).toBe("ai");
      expect(outcome.result.data).toEqual(goodResponse);
      expect(outcome.result.data.headline).toContain(request.bestOptionName);
    }
  });

  it("rejects a response where a field is a number instead of a display string", () => {
    const result = aiExplainResponseSchema.safeParse({
      headline: "Recycled PET cup wins",
      summary: 42,
      keyReasons: ["Lower modeled impact"],
    });
    expect(result.success).toBe(false);
  });
});
