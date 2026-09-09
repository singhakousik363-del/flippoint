import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/explain", () => ({
  generateDecisionBrief: vi.fn(),
}));

const { generateDecisionBrief } = await import("@/lib/ai/explain");
const { POST } = await import("@/app/api/ai/explain/route");

function makeRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/ai/explain", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("POST /api/ai/explain", () => {
  it("rejects a body declared too large via content-length", async () => {
    const res = await makeRequestWithLength();
    expect(res.status).toBe(413);
  });

  async function makeRequestWithLength() {
    const req = makeRequest("{}", { "content-length": String(30_000) });
    return POST(req);
  }

  it("rejects invalid JSON", async () => {
    const res = await POST(makeRequest("not json"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/valid JSON/);
  });

  it("returns 400 when the request payload fails schema validation", async () => {
    vi.mocked(generateDecisionBrief).mockResolvedValue({ ok: false, error: "Invalid request payload: bad" });
    const res = await POST(makeRequest(JSON.stringify({ decisionName: "x" })));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid request payload");
  });

  it("returns the deterministic-safe result on success, whatever its source", async () => {
    const result = {
      source: "fallback" as const,
      data: { headline: "h", summary: "s", keyReasons: ["r"] },
      reason: "AI service unavailable.",
    };
    vi.mocked(generateDecisionBrief).mockResolvedValue({ ok: true, result });
    const res = await POST(makeRequest(JSON.stringify({ decisionName: "x" })));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(result);
  });
});
