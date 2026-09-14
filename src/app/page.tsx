import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { DecisionFlipPreview } from "@/components/landing/decision-flip-preview";
import { MethodologyNote } from "@/components/landing/methodology-note";
import { DemoCtaBand } from "@/components/landing/demo-cta-band";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <Hero />
      <HowItWorks />
      <DecisionFlipPreview />
      <MethodologyNote />
      <DemoCtaBand />
      <footer className="mx-auto w-full max-w-4xl px-6 py-8 text-center text-xs text-muted-foreground">
        FlipPoint — built for NextStep Hacks 2026.
      </footer>
    </div>
  );
}
