"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangleIcon, ChevronDownIcon, RefreshCwIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { buildAiExplainRequest } from "@/lib/decision/ai-brief";
import { computeDecisionSensitivity } from "@/lib/decision/sensitivity";
import type { AiExplainResponse } from "@/lib/ai/schema";
import type { DecisionResults } from "@/lib/decision/compute";
import type { Decision } from "@/types/decision";

type FetchState =
  | { status: "idle" }
  | { status: "done"; source: "ai" | "fallback"; data: AiExplainResponse }
  | { status: "error" };

async function fetchBrief(payload: unknown): Promise<
  { source: "ai" | "fallback"; data: AiExplainResponse } | null
> {
  const res = await fetch("/api/ai/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  const body = await res.json();
  if (!body || (body.source !== "ai" && body.source !== "fallback") || !body.data) return null;
  return { source: body.source, data: body.data as AiExplainResponse };
}

export function AIDecisionBrief({ decision, results }: { decision: Decision; results: DecisionResults }) {
  const sensitivity = useMemo(() => {
    try {
      return computeDecisionSensitivity(decision);
    } catch {
      return null;
    }
  }, [decision]);

  const aiRequest = useMemo(
    () => buildAiExplainRequest(decision, results, sensitivity),
    [decision, results, sensitivity],
  );

  const [state, setState] = useState<FetchState>({ status: "idle" });
  // Identifies which (request, regeneration) pair `state` currently reflects.
  // While it differs from the live one below, a fetch is in flight — loading
  // is derived from that mismatch rather than set synchronously in the effect,
  // per the react-hooks/set-state-in-effect rule: setState may only happen
  // inside the fetch's own .then/.catch callback, not in the effect body.
  const [resolved, setResolved] = useState<{ key: string; nonce: number } | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const requestKey = aiRequest ? JSON.stringify(aiRequest) : null;

  useEffect(() => {
    if (!aiRequest || requestKey === null) return;
    let ignore = false;
    fetchBrief(aiRequest)
      .then((result) => {
        if (ignore) return;
        setState(result ? { status: "done", source: result.source, data: result.data } : { status: "error" });
      })
      .catch(() => {
        if (ignore) return;
        setState({ status: "error" });
      })
      .finally(() => {
        if (ignore) return;
        setResolved({ key: requestKey, nonce: refreshNonce });
      });
    return () => {
      ignore = true;
    };
    // aiRequest is derived solely from requestKey; re-running only on
    // requestKey/refreshNonce avoids refetching on every unrelated re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, refreshNonce]);

  if (!aiRequest || requestKey === null) return null;

  const isLoading = !(resolved && resolved.key === requestKey && resolved.nonce === refreshNonce);

  const bestOption = results.options.find((o) => o.optionId === results.bestOptionId);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>Decision brief</CardTitle>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Regenerate AI explanation"
          onClick={() => setRefreshNonce((n) => n + 1)}
        >
          <RefreshCwIcon className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 rounded-lg border-l-2 border-primary bg-primary/[0.04] py-2 pl-3.5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Deterministic result
          </span>
          <p className="text-base font-semibold">
            {bestOption?.optionName ?? aiRequest.bestOptionName} currently ranks best.
          </p>
        </div>

        <ChevronDownIcon className="mx-auto size-3.5 text-muted-foreground/50" />

        {isLoading && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        )}

        {!isLoading && state.status === "error" && (
          <Alert variant="destructive">
            <AlertTriangleIcon />
            <AlertTitle>AI explanation unavailable</AlertTitle>
            <AlertDescription>
              The deterministic result above is unaffected — only the natural-language explanation could not be
              generated right now.
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && state.status === "done" && state.source === "fallback" && (
          <FallbackBriefBody data={state.data} />
        )}

        {!isLoading && state.status === "done" && state.source === "ai" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-3 rounded-lg border border-dashed border-secondary-foreground/15 bg-secondary/40 p-4"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <SparklesIcon className="size-3.5" />
              AI explanation
            </div>
            <p className="text-sm font-medium text-foreground/90">{state.data.headline}</p>
            <p className="text-sm text-muted-foreground">{state.data.summary}</p>
            {state.data.keyReasons.length > 0 && (
              <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-muted-foreground">
                {state.data.keyReasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            )}

            {(state.data.caution || state.data.action) && (
              <div className="flex flex-col gap-2 rounded-md border-l-2 border-warning/50 bg-warning/[0.08] px-3 py-2">
                <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  Caveat
                </span>
                {state.data.caution && <p className="text-xs text-muted-foreground">{state.data.caution}</p>}
                {state.data.action && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">Suggested next step — </span>
                    {state.data.action}
                  </p>
                )}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              AI-generated explanation of the deterministic result above — not a source of new numbers or a
              certified assessment.
            </p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

function FallbackBriefBody({ data }: { data: AiExplainResponse }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border-l-2 border-primary/60 bg-primary/[0.03] p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <ShieldCheckIcon className="size-3.5 text-primary" />
        Deterministic summary — AI explanation unavailable right now
      </div>
      <p className="text-sm font-medium">{data.headline}</p>
      <p className="text-sm text-muted-foreground">{data.summary}</p>
      {data.keyReasons.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-muted-foreground">
          {data.keyReasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      )}
      {data.caution && (
        <div className="flex flex-col gap-1 rounded-md border-l-2 border-warning/50 bg-warning/[0.08] px-3 py-2">
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Caveat</span>
          <p className="text-xs text-muted-foreground">{data.caution}</p>
        </div>
      )}
    </div>
  );
}
