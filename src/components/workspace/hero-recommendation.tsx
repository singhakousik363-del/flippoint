"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { LeafIcon, TrophyIcon, ZapIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { computeDecisionSensitivity } from "@/lib/decision/sensitivity";
import { computeImpactDifference } from "@/lib/decision/impact-difference";
import { formatKgCo2e, formatRange } from "@/lib/format";
import type { DecisionResults } from "@/lib/decision/compute";
import type { ImpactResult } from "@/lib/engine/engine";
import type { Decision } from "@/types/decision";

const CONFIDENCE_LABEL: Record<ImpactResult["confidence"], string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

const CONFIDENCE_VARIANT: Record<ImpactResult["confidence"], "default" | "secondary" | "outline"> = {
  high: "default",
  medium: "secondary",
  low: "outline",
};

/**
 * The dominant "here's the answer" moment of the workspace — every figure
 * here is read directly off the already-computed deterministic results,
 * nothing is recalculated for display purposes.
 */
export function HeroRecommendation({ decision, results }: { decision: Decision; results: DecisionResults }) {
  const best = results.options.find((o) => o.optionId === results.bestOptionId);

  const sensitivity = useMemo(() => {
    try {
      return computeDecisionSensitivity(decision);
    } catch {
      return null;
    }
  }, [decision]);

  if (!best || best.error) return null;

  const range = formatRange(best.perUnitImpact.low, best.perUnitImpact.high);
  const comparedCount = results.options.filter((o) => !o.error).length;
  const top = sensitivity?.mostSensitiveVariable;
  const impactDiff = computeImpactDifference(results);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="eco-mesh relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <TrophyIcon className="size-4" />
          </span>
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Current recommendation
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{best.optionName}</h2>
          <p className="text-sm text-muted-foreground">
            {best.isReusable ? "Reusable" : "Single-use"} · lowest modeled impact among {comparedCount} options
            compared
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 border-t border-border pt-6 sm:grid-cols-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{best.isReusable ? "Per use" : "Per unit"}</span>
            <span className="font-heading text-2xl font-semibold tabular-nums">
              {formatKgCo2e(best.perUnitImpact.central)}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {range ?? "No source-stated range"}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Annual impact</span>
            <span className="font-heading text-2xl font-semibold tabular-nums">
              {formatKgCo2e(best.annualImpact.central)}
            </span>
            <span className="text-xs text-muted-foreground">
              {decision.annualVolume.toLocaleString()} units/year
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Confidence</span>
            <Badge variant={CONFIDENCE_VARIANT[best.perUnitImpact.confidence]} className="w-fit">
              {CONFIDENCE_LABEL[best.perUnitImpact.confidence]}
            </Badge>
          </div>
        </div>

        {impactDiff && (
          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-3.5 text-sm">
            <LeafIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Environmental impact difference
              </span>{" "}
              vs. runner-up <strong className="font-medium text-foreground">{impactDiff.runnerUpOptionName}</strong>:{" "}
              <strong className="font-medium text-foreground">{formatKgCo2e(impactDiff.perUnitDifference)}</strong>{" "}
              less {best.isReusable ? "per use" : "per unit"}, and{" "}
              <strong className="font-medium text-foreground">{formatKgCo2e(impactDiff.annualDifference)}</strong>{" "}
              less annually.
            </span>
          </div>
        )}

        {top && (
          <a
            href="#sensitivity"
            className="group flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-3.5 text-sm transition-colors hover:border-primary/40 hover:bg-primary/[0.05]"
          >
            <ZapIcon className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="text-muted-foreground">
              Strongest decision driver: <strong className="font-medium text-foreground">{top.label}</strong>
              {top.recommendationFlipsInRange
                ? " — a plausible change here could flip this recommendation."
                : " — not enough on its own to flip this recommendation."}{" "}
              <span className="text-foreground underline-offset-2 group-hover:underline">
                See what would change it →
              </span>
            </span>
          </a>
        )}

        <p className="text-[11px] text-muted-foreground">
          Modeled estimate from the deterministic calculation engine — not a certified LCA.
        </p>
      </div>
    </motion.section>
  );
}
