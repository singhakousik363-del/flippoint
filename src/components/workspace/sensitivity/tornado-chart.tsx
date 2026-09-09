"use client";

import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatKgCo2e } from "@/lib/format";
import { SENSITIVITY_VARIATION_PCT } from "@/lib/decision/sensitivity";
import type { SensitivityVariableResult } from "@/lib/decision/sensitivity";

const SAFE_COLOR = "var(--color-muted-foreground)";
// Amber, not destructive red: a decision-sensitive variable is information,
// not an error — red is reserved for things that are actually broken.
const FLIP_COLOR = "var(--color-warning)";

interface TornadoRow {
  key: string;
  shortLabel: string;
  fullLabel: string;
  base: number;
  range: number;
  low: number;
  high: number;
  flips: boolean;
}

// Kept short enough that the label column stays legible even on a narrow
// phone viewport, where the chart's total width can be under 300px.
function truncate(label: string, max = 20): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function TornadoTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: TornadoRow }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{row.fullLabel}</p>
      <p className="text-muted-foreground">
        Range: {formatKgCo2e(row.low)} to {formatKgCo2e(row.high)}
      </p>
      <p className="text-muted-foreground">Swing: {formatKgCo2e(row.range)}</p>
      {row.flips && <p className="mt-1 font-medium text-destructive">Could flip your decision</p>}
    </div>
  );
}

export function TornadoChart({ variables }: { variables: SensitivityVariableResult[] }) {
  const data: TornadoRow[] = variables
    .filter((v) => v.diffAtLow !== null && v.diffAtHigh !== null)
    .map((v) => {
      const low = Math.min(v.diffAtLow!, v.diffAtHigh!);
      const high = Math.max(v.diffAtLow!, v.diffAtHigh!);
      return {
        key: v.key,
        shortLabel: truncate(v.axisLabel),
        fullLabel: v.axisLabel,
        base: low,
        range: high - low,
        low,
        high,
        flips: v.recommendationFlipsInRange,
      };
    });

  if (data.length === 0) return null;

  const allBounds = data.flatMap((d) => [d.low, d.high, 0]);
  const min = Math.min(...allBounds);
  const max = Math.max(...allBounds);
  const pad = (max - min) * 0.15 || Math.max(Math.abs(max), Math.abs(min), 0.001) * 0.15;

  return (
    <div className="flex flex-col gap-2">
      <div style={{ height: Math.min(420, Math.max(140, data.length * 56)) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 12, bottom: 8, left: 8 }}
            barCategoryGap={10}
          >
            <XAxis
              type="number"
              domain={[min - pad, max + pad]}
              tickFormatter={(v: number) => formatKgCo2e(v)}
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="shortLabel"
              width={128}
              tick={{ fontSize: 12, fill: "var(--color-foreground)" }}
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
            />
            <ReferenceLine x={0} stroke="var(--color-foreground)" strokeWidth={1.5} strokeDasharray="3 3" />
            <Tooltip content={<TornadoTooltip />} cursor={{ fill: "var(--color-muted)", opacity: 0.3 }} />
            <Bar dataKey="base" stackId="tornado" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="range" stackId="tornado" radius={4} maxBarSize={22} animationDuration={500}>
              {data.map((row, i) => (
                <Cell
                  key={row.key}
                  fill={row.flips ? FLIP_COLOR : SAFE_COLOR}
                  stroke={i === 0 ? "var(--color-primary)" : "transparent"}
                  strokeWidth={i === 0 ? 1.5 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">
        Each bar probes one assumption by ±{SENSITIVITY_VARIATION_PCT}% and shows how far the modeled impact gap could
        swing — ranked by strongest driver first (outlined) down to least influential.
      </p>
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: SAFE_COLOR }} />
          Doesn&apos;t change your recommendation
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: FLIP_COLOR }} />
          Could flip your recommendation
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-px w-3 border-t border-dashed border-foreground" />
          Decision boundary (0)
        </span>
      </div>
    </div>
  );
}
