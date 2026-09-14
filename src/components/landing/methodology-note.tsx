import { CalculatorIcon, LibraryIcon, MessageSquareTextIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const pillars = [
  {
    icon: CalculatorIcon,
    title: "Deterministic engine",
    description: "Every environmental figure is calculated the same way, every time — no randomness, no guessing.",
  },
  {
    icon: LibraryIcon,
    title: "Cited sources",
    description: "Each emission factor traces back to a named source, publication year, and calculation basis.",
  },
  {
    icon: MessageSquareTextIcon,
    title: "AI explains, never calculates",
    description: "Language models describe results in plain English. They cannot compute, invent, or override a number.",
  },
];

export function MethodologyNote() {
  return (
    <section id="methodology" className="mx-auto w-full max-w-3xl px-6 py-12">
      <Separator className="mb-10" />
      <div className="mx-auto mb-8 flex max-w-lg flex-col items-center gap-2 text-center">
        <h2 className="text-lg font-medium">Modeled estimates, transparently sourced</h2>
        <p className="text-sm text-muted-foreground">
          FlipPoint produces modeled decision-support estimates, not a certified Life Cycle
          Assessment (LCA).
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {pillars.map((p) => (
          <div key={p.title} className="flex flex-col items-center gap-2 text-center">
            <span className="flex size-9 items-center justify-center rounded-full bg-muted">
              <p.icon className="size-4 text-foreground" />
            </span>
            <h3 className="text-sm font-medium">{p.title}</h3>
            <p className="text-xs text-muted-foreground">{p.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
