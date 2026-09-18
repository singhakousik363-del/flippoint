"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRightIcon, CircleHelpIcon, SparklesIcon, ZapIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { getMaterial } from "@/lib/data/catalog";
import { computeDecisionSensitivity } from "@/lib/decision/sensitivity";
import { compareWhatIf } from "@/lib/decision/what-if";
import { buildFlipExplanation, computeChangedFields, formatThresholdValue } from "@/lib/decision/flip-explanation";
import { formatKgCo2e } from "@/lib/format";
import type { SensitivityVariableKind } from "@/lib/decision/sensitivity";
import type { Decision, ReusableSettingsDraft } from "@/types/decision";

/** Maps the plain-English slider labels used in this panel back to the
 *  sensitivity engine's variable kind, so the flip panel can surface the
 *  same deterministic break-even the sensitivity section already computed —
 *  never a second, independently-derived threshold. */
const LABEL_TO_KIND: Record<string, SensitivityVariableKind> = {
  "Item mass": "mass",
  "Transport distance": "transportDistance",
  "Recycled content": "recycledContent",
  "Rated reuse cycles": "reusableMaxCycles",
  "Loss rate per cycle": "reusableLossRate",
};

interface SliderState {
  massGrams: number;
  transportDistanceKm: number;
  recycledContentPct: number;
  reusableSettings: ReusableSettingsDraft | null;
}

function sliderStateFromOption(option: Decision["options"][number]): SliderState {
  return {
    massGrams: option.massGrams,
    transportDistanceKm: option.transportDistanceKm ?? 0,
    recycledContentPct: option.recycledContentPct,
    reusableSettings: option.reusableSettings,
  };
}

function AnimatedValue({ value }: { value: string }) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.span
        key={value}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        transition={{ duration: 0.18 }}
        className="inline-block font-medium tabular-nums"
      >
        {value}
      </motion.span>
    </AnimatePresence>
  );
}

export function WhatIfSimulator({ decision }: { decision: Decision }) {
  const prefersReducedMotion = useReducedMotion();
  const crossfadeTransition = prefersReducedMotion ? { duration: 0 } : { duration: 0.2 };
  const badgeTransition = prefersReducedMotion ? { duration: 0 } : { duration: 0.3, ease: "easeOut" as const };

  const [selectedOptionId, setSelectedOptionId] = useState(decision.options[0]?.id ?? "");
  const selectedOption = decision.options.find((o) => o.id === selectedOptionId) ?? decision.options[0];

  const [sliders, setSliders] = useState<SliderState>(() =>
    selectedOption ? sliderStateFromOption(selectedOption) : {
      massGrams: 0,
      transportDistanceKm: 0,
      recycledContentPct: 0,
      reusableSettings: null,
    },
  );

  function handleSelectOption(optionId: string) {
    const option = decision.options.find((o) => o.id === optionId);
    if (!option) return;
    setSelectedOptionId(optionId);
    setSliders(sliderStateFromOption(option));
  }

  const material = selectedOption ? getMaterial(selectedOption.materialCode) : null;
  const supportsRecycledContent = Boolean(material?.recycledFactorId);
  const isReusable = Boolean(selectedOption?.reusable && selectedOption.reusableSettings);

  const comparison = useMemo(() => {
    if (!selectedOption) return null;
    try {
      return compareWhatIf(decision, selectedOption.id, {
        massGrams: sliders.massGrams,
        transportDistanceKm: sliders.transportDistanceKm,
        recycledContentPct: sliders.recycledContentPct,
        reusableSettings: sliders.reusableSettings,
      });
    } catch {
      return null;
    }
  }, [decision, selectedOption, sliders]);

  // Memoized on `decision` alone (never on the sliders) so dragging a slider
  // never re-runs the sensitivity/root-finding engine — only a cheap lookup
  // below reacts to the drag, keeping what-if interactions instant.
  const sensitivity = useMemo(() => {
    try {
      return computeDecisionSensitivity(decision);
    } catch {
      return null;
    }
  }, [decision]);

  if (!selectedOption) return null;

  const currentWinner = comparison?.currentResults.options.find(
    (o) => o.optionId === comparison.currentBestOptionId,
  );
  const scenarioWinner = comparison?.scenarioResults.options.find(
    (o) => o.optionId === comparison.scenarioBestOptionId,
  );

  const changedFields = computeChangedFields(selectedOption, sliders, {
    supportsRecycledContent,
    isReusable,
  });

  const primaryThresholdKind = changedFields.length > 0 ? LABEL_TO_KIND[changedFields[0].label] : undefined;
  const primaryThreshold = primaryThresholdKind
    ? (sensitivity?.variables.find((v) => v.optionId === selectedOption.id && v.kind === primaryThresholdKind) ?? null)
    : null;

  const flipExplanation = comparison ? buildFlipExplanation(comparison, changedFields, primaryThreshold) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="size-4" />
          What if...?
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="whatif-option">Adjust</Label>
          <Select value={selectedOptionId} onValueChange={(v) => v && handleSelectOption(v)}>
            <SelectTrigger id="whatif-option" className="w-full sm:w-64">
              <SelectValue>
                {(value: string) => decision.options.find((o) => o.id === value)?.name ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {decision.options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SliderControl
            label="Item mass"
            value={sliders.massGrams}
            min={0.5}
            max={Math.max(200, selectedOption.massGrams * 3)}
            step={0.5}
            unit="g"
            onChange={(v) => setSliders((s) => ({ ...s, massGrams: v }))}
          />
          <SliderControl
            label="Transport distance"
            value={sliders.transportDistanceKm}
            min={0}
            max={Math.max(2000, (selectedOption.transportDistanceKm ?? 0) * 3)}
            step={5}
            unit="km"
            onChange={(v) => setSliders((s) => ({ ...s, transportDistanceKm: v }))}
          />
          {supportsRecycledContent && (
            <SliderControl
              label="Recycled content"
              value={sliders.recycledContentPct}
              min={0}
              max={100}
              step={1}
              unit="%"
              onChange={(v) => setSliders((s) => ({ ...s, recycledContentPct: v }))}
            />
          )}
          {isReusable && sliders.reusableSettings && (
            <>
              <SliderControl
                label="Rated reuse cycles"
                value={sliders.reusableSettings.maxCycles}
                min={1}
                max={Math.max(1000, sliders.reusableSettings.maxCycles * 3)}
                step={5}
                unit=""
                onChange={(v) =>
                  setSliders((s) => ({
                    ...s,
                    reusableSettings: { ...s.reusableSettings!, maxCycles: Math.round(v) },
                  }))
                }
              />
              <SliderControl
                label="Loss rate per cycle"
                value={sliders.reusableSettings.lossRatePct}
                min={0}
                max={50}
                step={0.5}
                unit="%"
                onChange={(v) =>
                  setSliders((s) => ({
                    ...s,
                    reusableSettings: { ...s.reusableSettings!, lossRatePct: v },
                  }))
                }
              />
            </>
          )}
        </div>

        {comparison && (
          <div
            className={`flex flex-col gap-4 rounded-xl border p-5 transition-colors duration-300 ${
              comparison.flips ? "border-warning/40 bg-warning/[0.06]" : "border-border bg-muted/30"
            }`}
          >
            <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
              <div className="flex flex-col gap-1 text-center sm:text-left">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Current
                </span>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={currentWinner?.optionName ?? "none"}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={crossfadeTransition}
                    className="text-base font-semibold"
                  >
                    {currentWinner?.optionName ?? "—"} wins
                  </motion.p>
                </AnimatePresence>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {currentWinner ? formatKgCo2e(currentWinner.perUnitImpact.central) : "—"}
                </p>
              </div>

              <motion.div
                key={comparison.flips ? "flipped" : "stable"}
                initial={{ rotate: 0 }}
                animate={{ rotate: comparison.flips ? 360 : 0 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className={`mx-auto flex size-9 items-center justify-center rounded-full border bg-background ${
                  comparison.flips ? "border-warning/50 text-warning" : "border-border text-muted-foreground"
                }`}
              >
                <ArrowRightIcon className="size-4" />
              </motion.div>

              <div className="flex flex-col gap-1 text-center sm:text-right">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Scenario
                </span>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={scenarioWinner?.optionName ?? "none"}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={crossfadeTransition}
                    className="text-base font-semibold"
                  >
                    {scenarioWinner?.optionName ?? "—"} wins
                  </motion.p>
                </AnimatePresence>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {scenarioWinner ? formatKgCo2e(scenarioWinner.perUnitImpact.central) : "—"}
                  {comparison.deltaPerUnitImpact !== 0 && (
                    <>
                      {" "}
                      ({comparison.deltaPerUnitImpact > 0 ? "+" : ""}
                      {formatKgCo2e(comparison.deltaPerUnitImpact)})
                    </>
                  )}
                </p>
              </div>
            </div>

            {changedFields.length > 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border/60 pt-3.5 sm:justify-start">
                {changedFields.map((f) => (
                  <span
                    key={f.label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs"
                  >
                    <span className="text-muted-foreground">{f.label}:</span>
                    <span className="text-muted-foreground">{f.from}</span>
                    <ArrowRightIcon className="size-3 text-muted-foreground" />
                    <AnimatedValue value={f.to} />
                  </span>
                ))}
              </div>
            ) : (
              <p className="border-t border-border/60 pt-3.5 text-center text-sm text-muted-foreground sm:text-left">
                No changes yet — move a slider above to explore a scenario.
              </p>
            )}

            {primaryThreshold && (
              <p className="text-xs text-muted-foreground">
                Modeled threshold — {primaryThreshold.label}{" "}
                {primaryThreshold.breakEven.solvable && primaryThreshold.breakEven.value !== null
                  ? `flips the recommendation at ${formatThresholdValue(primaryThreshold.breakEven.value, primaryThreshold.unit)} (currently ${formatThresholdValue(primaryThreshold.currentValue, primaryThreshold.unit)}).`
                  : `has no solvable break-even — ${primaryThreshold.breakEven.reason}`}
              </p>
            )}

            <AnimatePresence>
              {comparison.flips && (
                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.97, height: 0 }}
                  animate={{ opacity: 1, scale: 1, height: "auto" }}
                  exit={prefersReducedMotion ? { opacity: 1, scale: 1, height: "auto" } : { opacity: 0, scale: 0.97, height: 0 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25 }}
                  className="flex flex-col gap-3"
                >
                  <div className="flex flex-col items-center gap-1 rounded-lg border border-warning/40 bg-warning/15 px-4 py-3 text-center sm:flex-row sm:justify-center sm:gap-2">
                    <motion.span
                      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={badgeTransition}
                      className="flex items-center gap-1.5 text-sm font-semibold text-warning"
                    >
                      <ZapIcon className="size-4" />
                      DECISION FLIPPED
                    </motion.span>
                    <span className="text-sm text-warning/90">
                      <strong>{scenarioWinner?.optionName}</strong> becomes preferable instead of{" "}
                      <strong>{currentWinner?.optionName}</strong>.
                    </span>
                  </div>

                  {flipExplanation && (
                    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                      <h4 className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        <CircleHelpIcon className="size-3.5" />
                        Why did it flip?
                      </h4>
                      <p className="text-foreground">{flipExplanation.sentence}</p>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border/60 pt-2.5 text-xs sm:grid-cols-4">
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-muted-foreground">Previous winner</dt>
                          <dd className="font-medium text-foreground">{flipExplanation.previousWinnerName}</dd>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-muted-foreground">New winner</dt>
                          <dd className="font-medium text-foreground">{flipExplanation.newWinnerName}</dd>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-muted-foreground">
                            {flipExplanation.primaryVariableLabel ?? "Primary variable"}
                          </dt>
                          <dd className="font-medium tabular-nums text-foreground">
                            {flipExplanation.previousValue && flipExplanation.scenarioValue
                              ? `${flipExplanation.previousValue} → ${flipExplanation.scenarioValue}`
                              : "—"}
                          </dd>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-muted-foreground">Break-even threshold</dt>
                          <dd className="font-medium tabular-nums text-foreground">
                            {flipExplanation.threshold ? flipExplanation.threshold.formatted : "Not solvable"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-sm tabular-nums text-muted-foreground">
          <AnimatedValue value={`${value.toFixed(unit === "%" || unit === "g" ? 1 : 0)}${unit ? ` ${unit}` : ""}`} />
        </span>
      </div>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => typeof v === "number" && onChange(v)}
        aria-label={label}
      />
    </div>
  );
}
