"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OptionCard } from "@/components/decision/option-card";
import { useDecisionStore } from "@/store/decision-store";

export function OptionList({ errors }: { errors: Record<string, string> }) {
  const options = useDecisionStore((s) => s.decision.options);
  const addOption = useDecisionStore((s) => s.addOption);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Packaging options</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={addOption}
          disabled={options.length >= 4}
        >
          <PlusIcon /> Add option
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {options.map((option, index) => (
          <OptionCard
            key={option.id}
            option={option}
            index={index}
            canRemove={options.length > 2}
            errors={errors}
          />
        ))}
      </div>

      {options.length >= 4 && (
        <p className="text-xs text-muted-foreground">
          You can compare up to 4 options at a time.
        </p>
      )}
    </div>
  );
}
