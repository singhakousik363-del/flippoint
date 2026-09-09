import { decisionSchema, flattenIssues } from "@/lib/validation/decision";
import type { Decision } from "@/types/decision";

export interface DecisionValidation {
  valid: boolean;
  /** Field-level messages keyed by dot path, e.g. "name", "options.0.massGrams". */
  errors: Record<string, string>;
}

export function validateDecision(decision: Decision): DecisionValidation {
  const result = decisionSchema.safeParse(decision);
  if (result.success) return { valid: true, errors: {} };
  return { valid: false, errors: flattenIssues(result.error) };
}
