import { useCallback, useEffect, useState } from "react";
import type { MultiBet, PickLeg } from "@lib/types";
import { AU_BOOKMAKERS } from "@lib/types";
import {
  combinedPriceForBookieWithCatalog,
  type BookiePriceOpts,
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
  catalog?: PickLeg[],
  /** Official card: preview other books; headline stays on published bookie. */
  displayOnlyPublished?: string,
  priceOpts?: BookiePriceOpts
) {
  const pool = catalog?.length ? catalog : legs;
  const hardLock = locked && !displayOnlyPublished ? locked : undefined;
  const [bookie, setBookie] = useState<string | undefined>(() => {
    if (displayOnlyPublished) return displayOnlyPublished;
    if (hardLock) return hardLock;
    try {
      const saved = localStorage.getItem(storageKey(multi));
      if (saved) return saved;
    } catch {
      /* ignore */
    }
    return pickDefaultBookie(multi, legs, preferred);
  });

  useEffect(() => {
    if (hardLock) {
      setBookie(hardLock);
      return;
    }
    setBookie((prev) => {
      if (prev != null && prev !== "") return prev;
      if (displayOnlyPublished) return displayOnlyPublished;
      return pickDefaultBookie(multi, legs, preferred);
    });
  }, [multi, legs, preferred, hardLock, displayOnlyPublished]);

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
      ? combinedPriceForBookieWithCatalog(legs, bookie, pool, priceOpts)
      : undefined;

  const publishedTotal =
    displayOnlyPublished != null && displayOnlyPublished.length > 0
      ? multi.bestBookieTotal ??
        combinedPriceForBookieWithCatalog(legs, displayOnlyPublished, pool, priceOpts)
      : undefined;

  return {
    bookie,
    select,
    offered,
    total,
    publishedBookie: displayOnlyPublished,
    publishedTotal,
  };
}