import Anthropic from "@anthropic-ai/sdk";

if (typeof window !== "undefined") {
  // Defense in depth: this module must never be pulled into a client bundle.
  // Next.js Route Handlers are server-only by construction, but this guard
  // fails loudly if something ever imports this file from a "use client" tree.
  throw new Error("lib/ai/client.ts must never be imported client-side.");
}

let cachedClient: Anthropic | null = null;

/** Thrown by the provider getters below when their env var is unset — lets
 *  callers distinguish "not configured" from a real runtime failure. */
export class MissingApiKeyError extends Error {}

/** Lazily constructs the Anthropic client from a server-only env var. Never
 *  reads a key from anywhere the browser could see (no NEXT_PUBLIC_ prefix). */
export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new MissingApiKeyError("ANTHROPIC_API_KEY is not configured on the server.");
  }
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey, timeout: 15_000, maxRetries: 1 });
  }
  return cachedClient;
}

/** Reads the Gemini API key from a server-only env var. Same guarantee as
 *  getAnthropicClient: never reads a key the browser could see. */
export function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new MissingApiKeyError("GEMINI_API_KEY is not configured on the server.");
  }
  return apiKey;
}
