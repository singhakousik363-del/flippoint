import { Badge } from "@/components/ui/badge";
import { formatKgCo2e, formatRange } from "@/lib/format";
import type { ImpactResult } from "@/lib/engine/engine";

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

export function ImpactStat({
  label,
  impact,
  showConfidence = true,
}: {
  label: string;
  impact: ImpactResult;
  showConfidence?: boolean;
}) {
  const range = formatRange(impact.low, impact.high);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-heading text-lg font-medium tabular-nums">
        {formatKgCo2e(impact.central)}
      </span>
      {range ? (
        <span className="text-xs text-muted-foreground tabular-nums">{range}</span>
      ) : (
        <span className="text-xs text-muted-foreground">No source-stated range</span>
      )}
      {showConfidence && (
        <Badge variant={CONFIDENCE_VARIANT[impact.confidence]} className="mt-1 w-fit">
          {CONFIDENCE_LABEL[impact.confidence]}
        </Badge>
      )}
    </div>
  );
}
