import { GitCompareIcon, SlidersHorizontalIcon, SparklesIcon, ZapIcon } from "lucide-react";

const steps = [
  {
    icon: GitCompareIcon,
    title: "Compare your options",
    description:
      "Enter 2–4 packaging options and FlipPoint models production, transport, and disposal impact for each — side by side.",
  },
  {
    icon: ZapIcon,
    title: "See what would change your decision",
    description:
      "Sensitivity analysis ranks every assumption by how much it could move the outcome, and finds the exact break-even point.",
  },
  {
    icon: SlidersHorizontalIcon,
    title: "Simulate a what-if scenario",
    description:
      "Drag a slider — volume, distance, recycled content — and watch the recommendation update instantly, live.",
  },
  {
    icon: SparklesIcon,
    title: "Get a plain-language explanation",
    description:
      "AI explains the deterministic result in plain English. It never calculates or invents a number — only the engine does that.",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-16">
      <div className="mx-auto mb-10 flex max-w-xl flex-col items-center gap-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">How FlipPoint works</h2>
        <p className="text-muted-foreground">
          Four steps from a packaging question to a defensible, source-backed answer.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <div key={step.title} className="relative flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <step.icon className="size-4.5" />
              </span>
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                Step {i + 1}
              </span>
            </div>
            <h3 className="font-heading text-base font-medium">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
