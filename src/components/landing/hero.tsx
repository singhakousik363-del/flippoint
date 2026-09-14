"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRightIcon, SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDecisionStore } from "@/store/decision-store";

export function Hero() {
  const router = useRouter();
  const loadDemo = useDecisionStore((s) => s.loadDemo);
  const [launching, setLaunching] = useState(false);

  function handleLiveDemo() {
    setLaunching(true);
    loadDemo();
    router.push("/workspace");
  }

  return (
    <section className="eco-mesh relative flex w-full flex-col items-center gap-6 overflow-hidden px-6 pt-24 pb-16 text-center">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Badge variant="secondary" className="gap-1.5">
          <SparklesIcon className="size-3" /> Environmental decision intelligence
        </Badge>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl"
      >
        Make better packaging decisions.
        <br />
        <span className="text-primary">Know what could change them.</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="max-w-xl text-lg text-muted-foreground text-balance"
      >
        FlipPoint compares environmental trade-offs with transparent, source-backed calculations —
        and shows exactly when your recommendation changes.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="flex flex-col items-center gap-3 sm:flex-row"
      >
        <Button size="lg" nativeButton={false} render={<Link href="/decision">Start a packaging decision</Link>} />
        <Button size="lg" variant="outline" onClick={handleLiveDemo} disabled={launching} className="gap-1.5">
          {launching ? "Loading demo…" : "Explore a live demo"}
          <ArrowRightIcon className="size-4" />
        </Button>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="text-xs text-muted-foreground"
      >
        The live demo loads a real seeded scenario and runs it through the same deterministic
        engine — no fabricated numbers.
      </motion.p>
    </section>
  );
}
