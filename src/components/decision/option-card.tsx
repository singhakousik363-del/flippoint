"use client";

import { XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ExcludedMaterialItem } from "@/components/decision/excluded-material-item";
import { Field } from "@/components/decision/field";
import { getDisposalOptionsFor, MATERIAL_CATALOG, TRANSPORT_CATALOG } from "@/lib/data/catalog";
import { PENDING_FACTORS } from "@/lib/data/pending-factors";
import { useDecisionStore } from "@/store/decision-store";
import type { DisposalPathway } from "@/types/domain";
import type { MaterialCode, PackagingOptionDraft } from "@/types/decision";

export function OptionCard({
  option,
  index,
  canRemove,
  errors,
  onFieldBlur,
}: {
  option: PackagingOptionDraft;
  index: number;
  canRemove: boolean;
  errors: Record<string, string>;
  onFieldBlur: (key: string) => void;
}) {
  const updateOption = useDecisionStore((s) => s.updateOption);
  const setReusable = useDecisionStore((s) => s.setReusable);
  const removeOption = useDecisionStore((s) => s.removeOption);

  const prefix = `options.${index}`;
  const material = MATERIAL_CATALOG.find((m) => m.code === option.materialCode) ?? MATERIAL_CATALOG[0];
  const disposalOptions = getDisposalOptionsFor(option.materialCode);
  const supportsRecycledContent = Boolean(material.recycledFactorId);

  function handleMaterialChange(materialCode: MaterialCode) {
    const nextMaterial = MATERIAL_CATALOG.find((m) => m.code === materialCode) ?? MATERIAL_CATALOG[0];
    const nextDisposalOptions = getDisposalOptionsFor(materialCode);
    const stillValidPathway = nextDisposalOptions.some((d) => d.pathway === option.disposalPathway);
    updateOption(option.id, {
      materialCode,
      disposalPathway: stillValidPathway ? option.disposalPathway : nextDisposalOptions[0].pathway,
      recycledContentPct: nextMaterial.recycledFactorId ? option.recycledContentPct : 0,
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="flex-1">
          <Field label="Option name" htmlFor={`${prefix}.name`} error={errors[`${prefix}.name`]}>
            <Input
              id={`${prefix}.name`}
              value={option.name}
              onChange={(e) => updateOption(option.id, { name: e.target.value })}
              onBlur={() => onFieldBlur(`${prefix}.name`)}
            />
          </Field>
        </div>
        {canRemove && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Remove option"
            onClick={() => removeOption(option.id)}
            className="mt-5"
          >
            <XIcon />
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field label="Material" htmlFor={`${prefix}.material`}>
          <Select
            value={option.materialCode}
            onValueChange={(value) =>
              value && MATERIAL_CATALOG.some((m) => m.code === value) && handleMaterialChange(value)
            }
          >
            <SelectTrigger id={`${prefix}.material`} className="w-full">
              <SelectValue>
                {(value: string) => MATERIAL_CATALOG.find((m) => m.code === value)?.label ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MATERIAL_CATALOG.map((m) => (
                <SelectItem key={m.code} value={m.code}>
                  {m.label}
                </SelectItem>
              ))}
              {PENDING_FACTORS.length > 0 && (
                <>
                  <SelectSeparator />
                  {PENDING_FACTORS.map((factor) => (
                    <ExcludedMaterialItem key={factor.id} factor={factor} />
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Item mass (grams)"
            htmlFor={`${prefix}.mass`}
            error={errors[`${prefix}.massGrams`]}
          >
            <Input
              id={`${prefix}.mass`}
              type="number"
              min={0}
              step="0.1"
              value={option.massGrams || ""}
              onChange={(e) => updateOption(option.id, { massGrams: e.target.valueAsNumber || 0 })}
              onBlur={() => onFieldBlur(`${prefix}.massGrams`)}
            />
          </Field>

          <Field
            label="Recycled content (%)"
            htmlFor={`${prefix}.recycled`}
            error={errors[`${prefix}.recycledContentPct`]}
            hint={!supportsRecycledContent ? "No verified recycled-content data for this material yet" : undefined}
          >
            <Input
              id={`${prefix}.recycled`}
              type="number"
              min={0}
              max={100}
              disabled={!supportsRecycledContent}
              value={supportsRecycledContent ? option.recycledContentPct || "" : ""}
              onChange={(e) =>
                updateOption(option.id, { recycledContentPct: e.target.valueAsNumber || 0 })
              }
              onBlur={() => onFieldBlur(`${prefix}.recycledContentPct`)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Transport distance (km)"
            htmlFor={`${prefix}.distance`}
            error={errors[`${prefix}.transportDistanceKm`]}
            hint="From supplier/distributor to you"
          >
            <Input
              id={`${prefix}.distance`}
              type="number"
              min={0}
              value={option.transportDistanceKm ?? ""}
              onChange={(e) =>
                updateOption(option.id, {
                  transportDistanceKm: Number.isNaN(e.target.valueAsNumber)
                    ? null
                    : e.target.valueAsNumber,
                })
              }
              onBlur={() => onFieldBlur(`${prefix}.transportDistanceKm`)}
            />
          </Field>

          <Field label="Transport mode" htmlFor={`${prefix}.transport-mode`}>
            <Select
              value={option.transportFactorId}
              onValueChange={(factorId) =>
                factorId && updateOption(option.id, { transportFactorId: factorId })
              }
            >
              <SelectTrigger id={`${prefix}.transport-mode`} className="w-full">
                <SelectValue>
                  {(value: string) =>
                    TRANSPORT_CATALOG.find((t) => t.factorId === value)?.label ?? value
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TRANSPORT_CATALOG.map((t) => (
                  <SelectItem key={t.factorId} value={t.factorId}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Disposal pathway" htmlFor={`${prefix}.disposal`}>
          <Select
            value={option.disposalPathway}
            onValueChange={(pathway) =>
              pathway && updateOption(option.id, { disposalPathway: pathway as DisposalPathway })
            }
          >
            <SelectTrigger id={`${prefix}.disposal`} className="w-full">
              <SelectValue>
                {(value: string) => disposalOptions.find((d) => d.pathway === value)?.label ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {disposalOptions.map((d) => (
                <SelectItem key={d.pathway} value={d.pathway}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <div>
            <Label htmlFor={`${prefix}.reusable`}>Reusable item</Label>
            <p className="text-xs text-muted-foreground">Washed and reused instead of discarded after one use</p>
          </div>
          <Switch
            id={`${prefix}.reusable`}
            checked={option.reusable}
            onCheckedChange={(checked) => setReusable(option.id, checked)}
          />
        </div>

        {option.reusable && option.reusableSettings && (
          <div className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3">
            <Badge variant="secondary" className="w-fit">
              Reusable settings
            </Badge>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Rated max cycles"
                htmlFor={`${prefix}.maxCycles`}
                error={errors[`${prefix}.reusableSettings.maxCycles`]}
              >
                <Input
                  id={`${prefix}.maxCycles`}
                  type="number"
                  min={1}
                  step={1}
                  value={option.reusableSettings.maxCycles || ""}
                  onChange={(e) =>
                    updateOption(option.id, {
                      reusableSettings: {
                        ...option.reusableSettings!,
                        maxCycles: Math.round(e.target.valueAsNumber || 0),
                      },
                    })
                  }
                  onBlur={() => onFieldBlur(`${prefix}.reusableSettings.maxCycles`)}
                />
              </Field>

              <Field
                label="Loss rate per cycle (%)"
                htmlFor={`${prefix}.lossRate`}
                error={errors[`${prefix}.reusableSettings.lossRatePct`]}
              >
                <Input
                  id={`${prefix}.lossRate`}
                  type="number"
                  min={0}
                  max={99.9}
                  step="0.1"
                  value={option.reusableSettings.lossRatePct}
                  onChange={(e) =>
                    updateOption(option.id, {
                      reusableSettings: {
                        ...option.reusableSettings!,
                        lossRatePct: e.target.valueAsNumber || 0,
                      },
                    })
                  }
                  onBlur={() => onFieldBlur(`${prefix}.reusableSettings.lossRatePct`)}
                />
              </Field>

              <Field
                label="Items washed per rack"
                htmlFor={`${prefix}.itemsPerWash`}
                error={errors[`${prefix}.reusableSettings.itemsPerWash`]}
              >
                <Input
                  id={`${prefix}.itemsPerWash`}
                  type="number"
                  min={1}
                  value={option.reusableSettings.itemsPerWash || ""}
                  onChange={(e) =>
                    updateOption(option.id, {
                      reusableSettings: {
                        ...option.reusableSettings!,
                        itemsPerWash: e.target.valueAsNumber || 0,
                      },
                    })
                  }
                  onBlur={() => onFieldBlur(`${prefix}.reusableSettings.itemsPerWash`)}
                />
              </Field>

              <Field
                label="Return transport per use (kgCO2e)"
                htmlFor={`${prefix}.returnTransport`}
                hint="0 if no return logistics"
              >
                <Input
                  id={`${prefix}.returnTransport`}
                  type="number"
                  min={0}
                  step="0.001"
                  value={option.reusableSettings.returnTransportPerUseKgCo2e}
                  onChange={(e) =>
                    updateOption(option.id, {
                      reusableSettings: {
                        ...option.reusableSettings!,
                        returnTransportPerUseKgCo2e: e.target.valueAsNumber || 0,
                      },
                    })
                  }
                />
              </Field>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
