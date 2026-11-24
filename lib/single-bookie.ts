import type { PickLeg } from "./types.js";
import { AU_BOOKMAKERS } from "./types.js";

export function legPriceAtBookie(leg: PickLeg, bookie: string): number | undefined {
  const p = leg.bookiePrices?.[bookie];
  if (p == null || p <= 1) return undefined;
  return p;
}

/** Product of leg prices at one bookie; undefined if any leg missing. */
export function combinedPriceForBookie(
  legs: PickLeg[],
  bookie: string
): number | undefined {
  if (!legs.length) return undefined;
  let product = 1;
  for (const leg of legs) {
    const p = legPriceAtBookie(leg, bookie);
    if (p == null) return undefined;
    product *= p;
  }
  return Math.round(product * 100) / 100;
}

export function bookiesWithFullMulti(legs: PickLeg[]): string[] {
  return AU_BOOKMAKERS.filter((book) => combinedPriceForBookie(legs, book) != null);
}

export interface SingleBookieQuote {
  bookie: string;
  price: number;
  meetsTakeAt: boolean;
  everyLegAtTakeAt: boolean;
}

/** Best AU bookie that prices every leg and meets multi take-at (combined ≥ take-at, each leg ≥ leg take-at). */
export function bestSingleBookieQuote(
  legs: PickLeg[],
  combinedTakeAt: number
): SingleBookieQuote | undefined {
  let best: SingleBookieQuote | undefined;
  for (const bookie of AU_BOOKMAKERS) {
    const price = combinedPriceForBookie(legs, bookie);
    if (price == null) continue;
    const everyLegAtTakeAt = legs.every((leg) => {
      const p = legPriceAtBookie(leg, bookie);
      return p != null && p >= leg.takeAt;
    });
    const meetsTakeAt = everyLegAtTakeAt && price >= combinedTakeAt;
    if (!meetsTakeAt) continue;
    if (!best || price > best.price) {
      best = { bookie, price, meetsTakeAt, everyLegAtTakeAt };
    }
  }
  return best;
}