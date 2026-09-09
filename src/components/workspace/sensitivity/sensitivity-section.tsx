"use client";

import { useMemo } from "react";
import { InfoIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { computeDecisionSensitivity } from "@/lib/decision/sensitivity";
import { InsightCard } from "@/components/workspace/sensitivity/insight-card";
import { TornadoChart } from "@/components/workspace/sensitivity/tornado-chart";
import { VariableCard } from "@/components/workspace/sensitivity/variable-card";
import type { Decision } from "@/types/decision";

export function SensitivitySection({ decision }: { decision: Decision }) {
  const sensitivity = useMemo(() => {
    try {
      return computeDecisionSensitivity(decision);
    } catch {
      return null;
    }
  }, [decision]);

  if (!sensitivity) {
    return (
      <section id="sensitivity" className="flex scroll-mt-8 flex-col gap-3">
        <h2 className="text-lg font-medium">What would change my decision?</h2>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <InfoIcon className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Sensitivity analysis needs at least two calculable options. Fix any calculation
              errors above, or add another option, to see what would change this decision.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section id="sensitivity" className="flex scroll-mt-8 flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">What would change my decision?</h2>
        <p className="text-sm text-muted-foreground">
          Comparing your best option, <strong>{sensitivity.bestOptionName}</strong>, against its
          closest competitor, <strong>{sensitivity.runnerUpOptionName}</strong>.
        </p>
      </div>

      <InsightCard sensitivity={sensitivity} />

      <Card>
        <CardContent className="flex flex-col gap-2 pt-4">
          <h3 className="text-sm font-medium">Which assumption matters most</h3>
          <TornadoChart variables={sensitivity.variables} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {sensitivity.variables.map((v, i) => (
          <VariableCard key={v.key} variable={v} isStrongest={i === 0} />
        ))}
      </div>
    </section>
  );
}
