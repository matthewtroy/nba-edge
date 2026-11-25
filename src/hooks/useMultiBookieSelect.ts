import { useCallback, useEffect, useState } from "react";
import type { MultiBet, PickLeg } from "@lib/types";
import { AU_BOOKMAKERS } from "@lib/types";
import { combinedPriceForBookie } from "@lib/single-bookie";
import { pickDefaultBookie } from "@lib/multi-display";

function storageKey(multi: MultiBet): string {
  return `multi-bookie:${multi.type}:${multi.variant ?? ""}:${multi.legs.join(",")}`;
}

export function useMultiBookieSelect(
  multi: MultiBet,
  legs: PickLeg[],
  preferred?: string
) {
  const [bookie, setBookie] = useState<string | undefined>(() => {
    try {
      const saved = localStorage.getItem(storageKey(multi));
      if (saved) return saved;
    } catch {
      /* ignore */
    }
    return pickDefaultBookie(multi, legs, preferred);
  });

  useEffect(() => {
  setBookie((prev) => prev ?? pickDefaultBookie(multi, legs, preferred));
  }, [multi, legs, preferred]);

  const select = useCallback(
    (b: string) => {
      setBookie(b);
      localStorage.setItem(storageKey(multi), b);
    },
    [multi]
  );

  const offered = AU_BOOKMAKERS.filter((b) => combinedPriceForBookie(legs, b) != null);
  const total =
    bookie != null ? combinedPriceForBookie(legs, bookie) : undefined;

  return { bookie, select, offered, total };
}