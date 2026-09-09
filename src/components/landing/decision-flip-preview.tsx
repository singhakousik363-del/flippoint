import { ArrowRightIcon, SlidersHorizontalIcon, ZapIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * A purely illustrative mockup of the signature "decision flip" moment —
 * generic option/assumption labels only, no environmental figures. The real
 * numbers live in the actual what-if simulator, computed by the engine.
 */
export function DecisionFlipPreview() {
  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-16">
      <div className="mx-auto mb-8 flex max-w-xl flex-col items-center gap-2 text-center">
        <Badge variant="outline">Illustrative example</Badge>
        <h2 className="text-2xl font-semibold tracking-tight">
          See the moment your decision flips
        </h2>
        <p className="text-muted-foreground">
          When a real assumption crosses its modeled threshold, EcoTrace shows exactly what
          changed, why, and what the new recommendation is — using the numbers already in your
          comparison, never invented ones.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-warning/40 bg-warning/[0.06] p-5">
        <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div className="flex flex-col gap-1 text-center sm:text-left">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Current
            </span>
            <p className="text-base font-semibold">Option B wins</p>
          </div>
          <div className="mx-auto flex size-9 items-center justify-center rounded-full border border-warning/50 bg-background text-warning">
            <ArrowRightIcon className="size-4" />
          </div>
          <div className="flex flex-col gap-1 text-center sm:text-right">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Scenario
            </span>
            <p className="text-base font-semibold">Option A wins</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border/60 pt-3.5 sm:justify-start">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
            <SlidersHorizontalIcon className="size-3" />
            Transport distance: 400 km <ArrowRightIcon className="size-3" /> 900 km
          </span>
        </div>

        <div className="flex flex-col items-center gap-1 rounded-lg border border-warning/40 bg-warning/15 px-4 py-3 text-center sm:flex-row sm:justify-center sm:gap-2">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-warning">
            <ZapIcon className="size-4" />
            DECISION FLIPPED
          </span>
          <span className="text-sm text-warning/90">
            Option A becomes preferable instead of Option B.
          </span>
        </div>
      </div>
    </section>
  );
}
