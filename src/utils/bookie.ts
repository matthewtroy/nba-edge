import type { PickLeg } from "@lib/types";
import { AU_BOOKMAKERS } from "@lib/types";

export function bookiesWithFullMulti(legs: PickLeg[]): string[] {
  const hits: string[] = [];
  for (const book of AU_BOOKMAKERS) {
    if (legs.every((l) => (l.bookiePrices?.[book] ?? 0) > 1)) hits.push(book);
  }
  return hits;
}

export function combinedPriceForBookie(
  legs: PickLeg[],
  bookie: string
): number | undefined {
  if (!legs.length) return undefined;
  let product = 1;
  for (const leg of legs) {
    const p = leg.bookiePrices?.[bookie];
    if (p == null || p <= 1) return undefined;
    product *= p;
  }
  return Math.round(product * 100) / 100;
}