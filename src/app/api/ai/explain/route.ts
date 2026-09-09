import { NextResponse } from "next/server";
import { generateDecisionBrief } from "@/lib/ai/explain";

// Generous but bounded — the request payload is a handful of short display
// strings, never raw user text at scale. Rejects abuse before we even touch JSON.parse.
const MAX_REQUEST_BYTES = 20_000;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Request payload too large." }, { status: 413 });
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Request payload too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const outcome = await generateDecisionBrief(body);
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json(outcome.result);
}
