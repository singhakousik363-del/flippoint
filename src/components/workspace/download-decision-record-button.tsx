"use client";

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildDecisionRecordFilename, buildDecisionRecordMarkdown } from "@/lib/decision/export-markdown";
import { downloadTextFile } from "@/lib/download-text-file";
import type { DecisionResults } from "@/lib/decision/compute";
import type { DecisionSensitivityResult } from "@/lib/decision/sensitivity";
import type { Decision } from "@/types/decision";

export function DownloadDecisionRecordButton({
  decision,
  results,
  sensitivity,
}: {
  decision: Decision;
  results: DecisionResults;
  sensitivity: DecisionSensitivityResult | null;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        const markdown = buildDecisionRecordMarkdown(decision, results, sensitivity);
        downloadTextFile(buildDecisionRecordFilename(decision), markdown);
      }}
    >
      <DownloadIcon /> Download decision record
    </Button>
  );
}
