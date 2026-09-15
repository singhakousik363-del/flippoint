import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const geminiApiKeyMock = vi.fn<() => string>();
const anthropicParseMock = vi.fn();
let anthropicConfigured = false;

vi.mock("@/lib/ai/client", () => ({
  getAnthropicClient: () => {
    if (!anthropicConfigured) {
      throw new Error("ANTHROPIC_API_KEY is not configured on the server.");
    }
    return { messages: { parse: anthropicParseMock } };
  },
  getGeminiApiKey: () => geminiApiKeyMock(),
}));

const { generateDecisionBrief } = await import("@/lib/ai/explain");
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

function geminiHttpResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  geminiApiKeyMock.mockReset();
  geminiApiKeyMock.mockReturnValue("fake-gemini-key");
  anthropicParseMock.mockReset();
  anthropicConfigured = false;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generateDecisionBrief — Gemini provider (used when ANTHROPIC_API_KEY is absent)", () => {
  it("falls back to the deterministic template when GEMINI_API_KEY is also absent", async () => {
    geminiApiKeyMock.mockImplementation(() => {
      throw new Error("GEMINI_API_KEY is not configured on the server.");
    });
    const outcome = await generateDecisionBrief(validRequest());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.source).toBe("fallback");
      expect(outcome.result.reason).toMatch(/AI service unavailable/);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls the Gemini REST endpoint with gemini-2.5-flash and returns a well-formed AI response", async () => {
    const goodResponse = {
      headline: "Recycled PET cup is the lower-impact choice",
      summary: "At 0.05 kg CO2e per unit versus 0.09 kg CO2e, the recycled option has less modeled impact.",
      keyReasons: ["Lower per-unit impact at high confidence"],
    };
    fetchMock.mockResolvedValue(
      geminiHttpResponse({
        candidates: [{ content: { parts: [{ text: JSON.stringify(goodResponse) }] }, finishReason: "STOP" }],
      }),
    );

    const outcome = await generateDecisionBrief(validRequest());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.source).toBe("ai");
      expect(outcome.result.data).toEqual(goodResponse);
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("gemini-2.5-flash:generateContent");
    expect(init.headers["x-goog-api-key"]).toBe("fake-gemini-key");
  });

  it("falls back when Gemini invents a number not present anywhere in the input", async () => {
    fetchMock.mockResolvedValue(
      geminiHttpResponse({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    headline: "Recycled PET cup wins",
                    summary: "It saves 42 kg CO2e per unit, which is a fabricated figure.",
                    keyReasons: ["Lower modeled impact"],
                  }),
                },
              ],
            },
            finishReason: "STOP",
          },
        ],
      }),
    );

    const outcome = await generateDecisionBrief(validRequest());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.source).toBe("fallback");
      expect(outcome.result.reason).toMatch(/unverified numbers/);
      expect(outcome.result.reason).toContain("42");
    }
  });

  it("falls back when Gemini blocks the response for safety", async () => {
    fetchMock.mockResolvedValue(geminiHttpResponse({ promptFeedback: { blockReason: "SAFETY" } }));
    const outcome = await generateDecisionBrief(validRequest());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.source).toBe("fallback");
      expect(outcome.result.reason).toMatch(/declined/);
    }
  });

  it("falls back when the Gemini response has no usable text", async () => {
    fetchMock.mockResolvedValue(geminiHttpResponse({ candidates: [{ finishReason: "STOP" }] }));
    const outcome = await generateDecisionBrief(validRequest());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.source).toBe("fallback");
      expect(outcome.result.reason).toMatch(/empty or malformed/);
    }
  });

  it("falls back when the Gemini call throws (network failure)", async () => {
    fetchMock.mockRejectedValue(new Error("network timeout"));
    const outcome = await generateDecisionBrief(validRequest());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.source).toBe("fallback");
      expect(outcome.result.reason).toMatch(/AI service unavailable/);
    }
  });

  it("falls back when Gemini returns a non-2xx HTTP status, without leaking response internals", async () => {
    fetchMock.mockResolvedValue(geminiHttpResponse({ error: "secret internal detail" }, false, 500));
    const outcome = await generateDecisionBrief(validRequest());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.source).toBe("fallback");
      expect(JSON.stringify(outcome.result)).not.toContain("secret internal detail");
    }
  });

  it("never overrides the deterministic best option in the fallback", async () => {
    fetchMock.mockRejectedValue(new Error("unavailable"));
    const request = validRequest();
    const outcome = await generateDecisionBrief(request);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.data.headline).toContain("Recycled PET cup");
    }
  });
});

describe("generateDecisionBrief — Gemini as fallback after an Anthropic runtime failure", () => {
  beforeEach(() => {
    anthropicConfigured = true;
  });

  it("tries Gemini when a configured Anthropic client fails at runtime (e.g. a 400 for insufficient credit)", async () => {
    anthropicParseMock.mockRejectedValue(new Error("400 insufficient credit"));
    const goodResponse = {
      headline: "Recycled PET cup is the lower-impact choice",
      summary: "At 0.05 kg CO2e per unit versus 0.09 kg CO2e, the recycled option has less modeled impact.",
      keyReasons: ["Lower per-unit impact at high confidence"],
    };
    fetchMock.mockResolvedValue(
      geminiHttpResponse({
        candidates: [{ content: { parts: [{ text: JSON.stringify(goodResponse) }] }, finishReason: "STOP" }],
      }),
    );

    const outcome = await generateDecisionBrief(validRequest());
    expect(anthropicParseMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.source).toBe("ai");
      expect(outcome.result.data).toEqual(goodResponse);
    }
  });

  it("still enforces verifyNoFabricatedNumbers on the Gemini response reached via the Anthropic-failure path", async () => {
    anthropicParseMock.mockRejectedValue(new Error("400 insufficient credit"));
    fetchMock.mockResolvedValue(
      geminiHttpResponse({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    headline: "Recycled PET cup wins",
                    summary: "It saves 42 kg CO2e per unit, which is a fabricated figure.",
                    keyReasons: ["Lower modeled impact"],
                  }),
                },
              ],
            },
            finishReason: "STOP",
          },
        ],
      }),
    );

    const outcome = await generateDecisionBrief(validRequest());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.source).toBe("fallback");
      expect(outcome.result.reason).toMatch(/unverified numbers/);
      expect(outcome.result.reason).toContain("42");
    }
  });

  it("falls back to the deterministic template when both Anthropic and Gemini fail at runtime", async () => {
    anthropicParseMock.mockRejectedValue(new Error("400 insufficient credit"));
    fetchMock.mockRejectedValue(new Error("network timeout"));

    const outcome = await generateDecisionBrief(validRequest());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.source).toBe("fallback");
      expect(outcome.result.reason).toMatch(/AI service unavailable/);
      expect(JSON.stringify(outcome.result)).not.toContain("insufficient credit");
    }
  });

  it("does not try Gemini when Anthropic succeeds but refuses to respond", async () => {
    anthropicParseMock.mockResolvedValue({ stop_reason: "refusal", parsed_output: null });

    const outcome = await generateDecisionBrief(validRequest());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.source).toBe("fallback");
      expect(outcome.result.reason).toMatch(/declined/);
    }
  });
});
