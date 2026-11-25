import { useCallback, useEffect, useState } from "react";
import type { MultiBet, PickLeg } from "@lib/types";
import { AU_BOOKMAKERS } from "@lib/types";
import {
  combinedPriceForBookieWithCatalog,
} from "@lib/single-bookie";
import { pickDefaultBookie } from "@lib/multi-display";

function storageKey(multi: MultiBet): string {
  return `multi-bookie:${multi.type}:${multi.variant ?? ""}:${multi.legs.join(",")}`;
}

export function useMultiBookieSelect(
  multi: MultiBet,
  legs: PickLeg[],
  preferred?: string,
  locked?: string,
  catalog?: PickLeg[]
) {
  const pool = catalog?.length ? catalog : legs;
  const [bookie, setBookie] = useState<string | undefined>(() => {
    if (locked) return locked;
    try {
      const saved = localStorage.getItem(storageKey(multi));
      if (saved) return saved;
    } catch {
      /* ignore */
    }
    return pickDefaultBookie(multi, legs, preferred);
  });

  useEffect(() => {
    if (locked) {
      setBookie(locked);
      return;
    }
    setBookie((prev) => prev ?? pickDefaultBookie(multi, legs, preferred));
  }, [multi, legs, preferred, locked]);

  const select = useCallback(
    (b: string) => {
      setBookie(b);
      localStorage.setItem(storageKey(multi), b);
    },
    [multi]
  );

  const offered = AU_BOOKMAKERS.filter(
    (b) => combinedPriceForBookieWithCatalog(legs, b, pool) != null
  );
  const total =
    bookie != null
      ? combinedPriceForBookieWithCatalog(legs, bookie, pool)
      : undefined;

  return { bookie, select, offered, total };
}