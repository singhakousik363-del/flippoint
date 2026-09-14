"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/decision/field";
import { useDecisionStore } from "@/store/decision-store";

export function DecisionForm({
  errors,
  onFieldBlur,
}: {
  errors: Record<string, string>;
  onFieldBlur: (key: string) => void;
}) {
  const decision = useDecisionStore((s) => s.decision);
  const setName = useDecisionStore((s) => s.setName);
  const setBusinessContext = useDecisionStore((s) => s.setBusinessContext);
  const setAnnualVolume = useDecisionStore((s) => s.setAnnualVolume);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Decision details</CardTitle>
        <CardDescription>What are you deciding, and at what scale?</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field label="Decision name" htmlFor="decision-name" error={errors.name}>
          <Input
            id="decision-name"
            placeholder="e.g. Cold cup packaging for 2026"
            value={decision.name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => onFieldBlur("name")}
          />
        </Field>

        <Field
          label="Business context"
          htmlFor="decision-context"
          hint="Optional — helps you remember why this decision mattered."
        >
          <Textarea
            id="decision-context"
            placeholder="e.g. Supplier contract renewal, sustainability audit, customer request..."
            value={decision.businessContext}
            onChange={(e) => setBusinessContext(e.target.value)}
            rows={3}
          />
        </Field>

        <Field
          label="Annual volume (units/year)"
          htmlFor="decision-volume"
          error={errors.annualVolume}
          hint="How many of this item do you go through per year?"
        >
          <Input
            id="decision-volume"
            type="number"
            min={0}
            inputMode="numeric"
            value={decision.annualVolume || ""}
            onChange={(e) => setAnnualVolume(e.target.valueAsNumber || 0)}
            onBlur={() => onFieldBlur("annualVolume")}
          />
        </Field>
      </CardContent>
    </Card>
  );
}
