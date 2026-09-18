"use client";

import { useState } from "react";
import { CheckIcon, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildShareUrl } from "@/lib/decision/share-link";
import type { Decision } from "@/types/decision";

export function CopyShareLinkButton({ decision }: { decision: Decision }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const url = buildShareUrl(decision);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      {copied ? (
        <>
          <CheckIcon /> Link copied
        </>
      ) : (
        <>
          <LinkIcon /> Copy share link
        </>
      )}
    </Button>
  );
}
