"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDecisionStore } from "@/store/decision-store";

export function DemoCtaBand() {
  const router = useRouter();
  const loadDemo = useDecisionStore((s) => s.loadDemo);
  const [launching, setLaunching] = useState(false);

  function handleLiveDemo() {
    setLaunching(true);
    loadDemo();
    router.push("/workspace");
  }

  return (
    <section className="border-t border-border bg-muted/30">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-6 py-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-balance">
          Ready to see what could change your decision?
        </h2>
        <p className="max-w-md text-muted-foreground">
          Jump straight into a seeded, real-engine scenario — no signup, no setup.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Button size="lg" onClick={handleLiveDemo} disabled={launching} className="gap-1.5">
            {launching ? "Loading demo…" : "Explore a live demo"}
            <ArrowRightIcon className="size-4" />
          </Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/decision">Start your own decision</Link>} />
        </div>
      </div>
    </section>
  );
}
