"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangleIcon, FlaskConicalIcon, SparklesIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AIDecisionBrief } from "@/components/workspace/ai-decision-brief";
import { CopyShareLinkButton } from "@/components/workspace/copy-share-link-button";
import { DownloadDecisionRecordButton } from "@/components/workspace/download-decision-record-button";
import { HeroRecommendation } from "@/components/workspace/hero-recommendation";
import { OptionResultCard } from "@/components/workspace/option-result-card";
import { SensitivitySection } from "@/components/workspace/sensitivity/sensitivity-section";
import { WhatIfSimulator } from "@/components/workspace/sensitivity/what-if-simulator";
import { computeDecisionResults } from "@/lib/decision/compute";
import { computeDecisionSensitivity } from "@/lib/decision/sensitivity";
import { decodeShareParam, SHARE_PARAM } from "@/lib/decision/share-link";
import { validateDecision } from "@/lib/decision/validate";
import { DEMO_DECISION_NAME, useDecisionStore } from "@/store/decision-store";
import { useDecisionStoreHydrated } from "@/store/use-hydrated";
import type { Decision } from "@/types/decision";

/** Decodes a `?share=...` param present at first paint, if any — read once
 *  up front so a shared link renders its scenario immediately instead of
 *  flashing whatever was in localStorage first. */
function readSharedDecisionFromUrl(): Decision | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get(SHARE_PARAM);
  if (!raw) return null;
  return decodeShareParam(raw);
}

export function ComparisonWorkspace() {
  const hydrated = useDecisionStoreHydrated();
  const storeDecision = useDecisionStore((s) => s.decision);
  const loadDemo = useDecisionStore((s) => s.loadDemo);
  const loadFromShare = useDecisionStore((s) => s.loadFromShare);
  const [sharedDecision] = useState<Decision | null>(readSharedDecisionFromUrl);

  // Once hydrated, adopt a valid shared decision into the store itself (same
  // convention as "Try a demo scenario") so the rest of the app — e.g. "Edit
  // decision" — sees it too, then drop the param so a later refresh or edit
  // doesn't get reset back to the shared snapshot.
  useEffect(() => {
    if (!hydrated || !sharedDecision) return;
    loadFromShare(sharedDecision);
    const url = new URL(window.location.href);
    url.searchParams.delete(SHARE_PARAM);
    window.history.replaceState(null, "", url.pathname + url.search);
  }, [hydrated, sharedDecision, loadFromShare]);

  const decision = sharedDecision ?? storeDecision;
  const { valid, errors } = useMemo(() => validateDecision(decision), [decision]);

  const results = useMemo(() => {
    if (!valid) return null;
    try {
      return { data: computeDecisionResults(decision), error: null as string | null };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : "Unknown calculation error" };
    }
  }, [decision, valid]);

  const sensitivity = useMemo(() => {
    if (!valid) return null;
    try {
      return computeDecisionSensitivity(decision);
    } catch {
      return null;
    }
  }, [decision, valid]);

  if (!hydrated) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-16">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!valid) {
    const messages = Object.values(errors);
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 py-24">
        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted">
              <FlaskConicalIcon className="size-5 text-muted-foreground" />
            </span>
            <div className="flex flex-col gap-1.5">
              <h1 className="text-xl font-semibold tracking-tight">Nothing to compare yet</h1>
              <p className="text-muted-foreground">
                {messages[0] ?? "Finish building your decision before comparing options."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button nativeButton={false} render={<Link href="/decision">Back to decision builder</Link>} />
              <Button variant="outline" onClick={loadDemo}>
                <SparklesIcon /> Try a live demo instead
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!results || results.error || !results.data) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-24">
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>Could not compute this comparison</AlertTitle>
          <AlertDescription>
            {results?.error ?? "An unexpected error occurred."}
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/decision">Back to decision builder</Link>}
          />
        </div>
      </div>
    );
  }

  const { data } = results;
  const isDemo = decision.name === DEMO_DECISION_NAME;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 text-2xl font-semibold tracking-tight break-words">{decision.name}</h1>
            {isDemo && <Badge variant="secondary">Demo scenario</Badge>}
          </div>
          <p className="text-muted-foreground">
            {decision.annualVolume.toLocaleString()} units/year
            {decision.businessContext ? ` · ${decision.businessContext}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyShareLinkButton decision={decision} />
          <DownloadDecisionRecordButton decision={decision} results={data} sensitivity={sensitivity} />
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/decision">Edit decision</Link>}
          />
        </div>
      </div>

      <HeroRecommendation decision={decision} results={data} />

      <AIDecisionBrief decision={decision} results={data} />

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-medium">Comparison</h2>
          <p className="text-sm text-muted-foreground">
            Every figure below comes from the deterministic calculation engine — full sourcing is
            one click away on each card.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.options.map((result) => (
            <OptionResultCard
              key={result.optionId}
              result={result}
              isBest={result.optionId === data.bestOptionId}
            />
          ))}
        </div>
      </section>

      <SensitivitySection decision={decision} />
      <WhatIfSimulator decision={decision} />

      <section id="assumptions" className="scroll-mt-8">
        <details className="group rounded-xl border border-border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium marker:content-none">
            <span>Methodology &amp; assumptions</span>
            <span className="text-xs font-normal text-muted-foreground transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <div className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
            <p>
              Every environmental figure above comes from a deterministic calculation engine using
              cited emission factors — never invented or AI-generated. Figures without a
              source-stated uncertainty range are marked &ldquo;low confidence&rdquo; rather than
              given a fabricated range. FlipPoint produces modeled decision-support estimates, not a
              certified Life Cycle Assessment (LCA).
            </p>
            <p className="mt-3">
              Each option card in the comparison above has its own &ldquo;Sourced factors&rdquo;
              disclosure with the exact factor, value, source, and publication year behind that
              option&apos;s numbers.
            </p>
            <p className="mt-3">
              Paper and plastic factors use different carbon-accounting conventions. WARM treats
              paper combustion CO₂ as biogenic (excluded from the total) and credits recycled paper
              with forest carbon sequestration. Paper-versus-plastic comparisons are therefore
              directionally useful, but the disposal figures are not sign-for-sign equivalent with
              the plastics entries.
            </p>
          </div>
        </details>
      </section>
    </div>
  );
}
