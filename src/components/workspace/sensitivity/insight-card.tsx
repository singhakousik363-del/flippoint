"use client";

import { motion } from "framer-motion";
import { ZapIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatKgCo2e } from "@/lib/format";
import type { DecisionSensitivityResult } from "@/lib/decision/sensitivity";

export function InsightCard({ sensitivity }: { sensitivity: DecisionSensitivityResult }) {
  const top = sensitivity.mostSensitiveVariable;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-4"
    >
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <ZapIcon className="size-4" />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-base font-medium leading-snug">{sensitivity.insightStatement}</p>
        {top && (
          <p className="text-sm text-muted-foreground">
            Varying it by the modeled probe range could shift the comparison by{" "}
            <span className="font-medium text-foreground">{formatKgCo2e(top.swing)}</span>
            {top.recommendationFlipsInRange ? (
              <>
                {" "}
                — enough to flip your recommendation between{" "}
                <strong>{sensitivity.bestOptionName}</strong> and{" "}
                <strong>{sensitivity.runnerUpOptionName}</strong>.
              </>
            ) : (
              <>
                {" "}
                — not enough on its own to change the recommendation between{" "}
                <strong>{sensitivity.bestOptionName}</strong> and{" "}
                <strong>{sensitivity.runnerUpOptionName}</strong>.
              </>
            )}
          </p>
        )}
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Badge variant="outline">Calculated from deterministic results</Badge>
          {top?.recommendationFlipsInRange && <Badge variant="warning">Decision-sensitive</Badge>}
        </div>
      </div>
    </motion.div>
  );
}
