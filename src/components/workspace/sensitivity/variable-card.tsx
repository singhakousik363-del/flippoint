import { ArrowRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatKgCo2e } from "@/lib/format";
import type { SensitivityVariableResult } from "@/lib/decision/sensitivity";

function formatValue(v: number, unit: string): string {
  const rounded = unit === "%" || unit === "km" || unit === "g" ? v.toFixed(1) : v.toFixed(0);
  return `${rounded}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
}

export function VariableCard({
  variable,
  isStrongest = false,
}: {
  variable: SensitivityVariableResult;
  isStrongest?: boolean;
}) {
  const flips = variable.recommendationFlipsInRange;

  return (
    <Card className={isStrongest ? "ring-1 ring-primary/50" : undefined}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-base break-words">
          {variable.label}
          {isStrongest && (
            <Badge variant="outline" className="border-primary/40 text-primary">
              Strongest driver
            </Badge>
          )}
        </CardTitle>
        {flips ? (
          <Badge variant="warning">Decision-sensitive</Badge>
        ) : (
          <Badge variant="outline">Stable</Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {variable.kind === "disposalPathway" && variable.categoricalOptions ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Disposal pathway is a discrete choice — modeled impact for each available option:
            </p>
            <ul className="flex flex-col gap-1.5">
              {variable.categoricalOptions.map((o) => (
                <li
                  key={o.pathway}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border border-border px-2.5 py-1.5 text-sm"
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-2 break-words">
                    {o.label}
                    {o.isCurrent && (
                      <Badge variant="outline" className="text-[10px]">
                        Current
                      </Badge>
                    )}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{formatKgCo2e(o.totalImpact)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Current</span>
                <span className="font-medium tabular-nums">
                  {formatValue(variable.currentValue, variable.unit)}
                </span>
              </div>
              <ArrowRightIcon className="size-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Break-even</span>
                <span className="font-medium tabular-nums">
                  {variable.breakEven.solvable && variable.breakEven.value !== null
                    ? formatValue(variable.breakEven.value, variable.unit)
                    : "n/a"}
                </span>
              </div>
            </div>

            {variable.breakEven.solvable ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-muted/50 px-2.5 py-2">
                  <span className="text-muted-foreground">Below threshold</span>
                  <p className="font-medium text-foreground">{variable.breakEven.belowOptionName} wins</p>
                </div>
                <div className="rounded-md bg-muted/50 px-2.5 py-2">
                  <span className="text-muted-foreground">Above threshold</span>
                  <p className="font-medium text-foreground">{variable.breakEven.aboveOptionName} wins</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{variable.breakEven.reason}</p>
            )}

            <p className="text-xs text-muted-foreground">
              Modeled threshold — {variable.breakEven.method === "analytical" ? "solved algebraically" : variable.breakEven.method === "numerical" ? "solved numerically" : "not applicable"} from the deterministic engine.
            </p>
          </>
        )}

        <p className="text-xs text-muted-foreground">{variable.assumptionNote}</p>
      </CardContent>
    </Card>
  );
}
