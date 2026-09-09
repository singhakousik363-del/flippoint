"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DecisionForm } from "@/components/decision/decision-form";
import { OptionList } from "@/components/decision/option-list";
import { useDecisionStore } from "@/store/decision-store";
import { useDecisionStoreHydrated } from "@/store/use-hydrated";
import { validateDecision } from "@/lib/decision/validate";

export default function DecisionBuilderPage() {
  const hydrated = useDecisionStoreHydrated();
  const decision = useDecisionStore((s) => s.decision);
  const loadDemo = useDecisionStore((s) => s.loadDemo);

  if (!hydrated) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-16">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { valid, errors } = validateDecision(decision);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-16 pb-32">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Build a packaging decision</h1>
          <p className="mt-1 text-muted-foreground">
            Compare 2–4 packaging options by modeled environmental impact.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadDemo}>
          Try a demo scenario
        </Button>
      </div>

      <DecisionForm errors={errors} />
      <OptionList errors={errors} />

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <p className="min-w-0 text-sm text-muted-foreground">
            {valid
              ? "Ready to compare."
              : "Fill in every required field to calculate a comparison."}
          </p>
          {valid ? (
            <Button nativeButton={false} render={<Link href="/workspace">Calculate</Link>} />
          ) : (
            <Button disabled>Calculate</Button>
          )}
        </div>
      </div>
    </div>
  );
}
