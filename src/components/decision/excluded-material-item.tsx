"use client";

import { useState } from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import type { BaseUIEvent } from "@base-ui/react/types";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import type { PendingFactor } from "@/lib/data/pending-factors";

/**
 * Renders one entry from pending-factors.ts inside the Material select as a
 * non-selectable row. It intentionally does NOT set base-ui's `disabled` prop
 * on Select.Item — that flag also swallows our own onClick/onKeyDown handlers,
 * which would make the expand disclosure below unreachable. Instead this stays
 * a normal (interactive) item whose activation is cancelled via
 * `preventBaseUIHandler()`, while `aria-disabled` announces it as unavailable.
 */
export function ExcludedMaterialItem({ factor }: { factor: PendingFactor }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = `excluded-factor-${factor.id}`;

  function toggle() {
    setExpanded((prev) => !prev);
  }

  return (
    <SelectPrimitive.Item
      value={factor.id}
      aria-disabled="true"
      aria-expanded={expanded}
      aria-controls={panelId}
      className="relative flex w-full cursor-default flex-col gap-1 rounded-md py-1.5 pr-2 pl-1.5 text-sm opacity-70 outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:opacity-100"
      onClick={(event) => {
        (event as BaseUIEvent<typeof event>).preventBaseUIHandler();
        toggle();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggle();
        }
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="whitespace-normal font-medium text-foreground">{factor.material}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant="outline">Excluded</Badge>
          <ChevronDownIcon
            aria-hidden="true"
            className={cn(
              "size-3.5 text-muted-foreground transition-transform",
              expanded && "rotate-180"
            )}
          />
        </div>
      </div>
      <p className="whitespace-normal text-xs text-muted-foreground">{factor.summary}</p>
      {expanded && (
        <div
          id={panelId}
          className="mt-1 flex flex-col gap-2 whitespace-normal rounded-md bg-muted/40 p-2 text-xs"
        >
          <p className="text-muted-foreground">{factor.reason}</p>
          <ul className="flex flex-col gap-2">
            {factor.candidateSources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline underline-offset-2 hover:text-foreground"
                  onClick={(event) => event.stopPropagation()}
                >
                  {source.name}
                </a>
                <p className="text-muted-foreground">{source.note}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SelectPrimitive.Item>
  );
}
