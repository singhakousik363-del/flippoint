import { AlertTriangleIcon, ChevronDownIcon, RecycleIcon, TrophyIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ImpactStat } from "@/components/workspace/impact-stat";
import { ProvenanceList } from "@/components/workspace/provenance-list";
import { formatKgCo2e, formatUses } from "@/lib/format";
import type { OptionResult } from "@/lib/decision/compute";

export function OptionResultCard({
  result,
  isBest,
}: {
  result: OptionResult;
  isBest: boolean;
}) {
  if (result.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{result.optionName}</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangleIcon />
            <AlertTitle>Could not calculate this option</AlertTitle>
            <AlertDescription>{result.error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isBest ? "ring-2 ring-primary/60" : undefined}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="min-w-0 break-words">{result.optionName}</CardTitle>
        <div className="flex flex-wrap gap-1.5">
          {isBest && (
            <Badge className="gap-1">
              <TrophyIcon className="size-3" /> Lowest modeled impact
            </Badge>
          )}
          <Badge variant="outline">{result.isReusable ? "Reusable" : "Single-use"}</Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <ImpactStat
            label={result.isReusable ? "Per use (calculated)" : "Per unit (calculated)"}
            impact={result.perUnitImpact}
          />
          <ImpactStat label="Annual (calculated)" impact={result.annualImpact} showConfidence={false} />
        </div>

        {result.confidenceVsBestOption && !isBest && (
          <p className="text-xs text-muted-foreground">
            vs. lowest-impact option: <strong>{result.confidenceVsBestOption.tier} confidence</strong>{" "}
            this option is actually different — {result.confidenceVsBestOption.explanation}
          </p>
        )}

        <Separator />

        {result.singleUse && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Lifecycle breakdown (calculated)
            </span>
            <div className="grid grid-cols-3 gap-3">
              <ImpactStat label="Production" impact={result.singleUse.production} showConfidence={false} />
              <ImpactStat label="Transport" impact={result.singleUse.transport} showConfidence={false} />
              <ImpactStat label="Disposal" impact={result.singleUse.disposal} showConfidence={false} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.singleUse.flags.recycledContentInterpolated && (
                <Badge variant="outline" className="gap-1">
                  <RecycleIcon className="size-3" /> Recycled-content: modeled (interpolated)
                </Badge>
              )}
              {result.singleUse.flags.defaultTransportAssumption && (
                <Badge variant="outline">Transport distance: default assumption</Badge>
              )}
            </div>
          </div>
        )}

        {result.reusable && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Reuse-cycle breakdown (calculated)
            </span>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Initial production + transport</span>
                <p className="tabular-nums">
                  {formatKgCo2e(result.reusable.fixed.production + result.reusable.fixed.transportInitial)}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">End-of-life (at retirement)</span>
                <p className="tabular-nums">{formatKgCo2e(result.reusable.fixed.endOfLife)}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Washing, per use</span>
                <p className="tabular-nums">{formatKgCo2e(result.reusable.recurring.washingPerUse)}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Expected effective lifetime</span>
                <p className="tabular-nums">{formatUses(result.reusable.effectiveCycles)} uses</p>
              </div>
            </div>

            {result.reusable.breakEvenVsLowestSingleUse && (
              <Alert variant={result.reusable.feasibility?.feasible ? "default" : "destructive"}>
                {!result.reusable.feasibility?.feasible && <AlertTriangleIcon />}
                <AlertTitle>
                  {result.reusable.breakEvenVsLowestSingleUse.reachable
                    ? `Break-even at ${formatUses(result.reusable.breakEvenVsLowestSingleUse.breakEvenUses)} uses`
                    : "No break-even under current assumptions"}
                </AlertTitle>
                <AlertDescription>
                  vs. &ldquo;{result.reusable.breakEvenVsLowestSingleUse.comparatorOptionName}&rdquo;
                  {result.reusable.feasibility ? ` — ${result.reusable.feasibility.note}` : null}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <Separator />
        <details className="group/provenance -mx-1">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md px-1 py-1 text-xs font-medium text-muted-foreground marker:content-none hover:text-foreground">
            <span>
              Sourced factors ({new Set(result.factorsUsed.map((f) => f.id)).size})
            </span>
            <ChevronDownIcon className="size-3.5 transition-transform group-open/provenance:rotate-180" />
          </summary>
          <div className="px-1 pt-2">
            <ProvenanceList factors={result.factorsUsed} />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
