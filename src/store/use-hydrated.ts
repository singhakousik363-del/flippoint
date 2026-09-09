"use client";

import { useSyncExternalStore } from "react";
import { useDecisionStore } from "@/store/decision-store";

/** True once the persisted decision draft has been read back from
 *  localStorage. Drives a real (not simulated) loading state — the store's
 *  default value exists before hydration, but may not match what was saved. */
export function useDecisionStoreHydrated(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => useDecisionStore.persist.onFinishHydration(onStoreChange),
    () => useDecisionStore.persist.hasHydrated(),
    () => false, // server snapshot: never hydrated during SSR
  );
}
