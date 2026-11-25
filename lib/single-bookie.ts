import type { PickLeg } from "./types.js";
import { AU_BOOKMAKERS } from "./types.js";
import { canonBookiePrices } from "./bookie-totals.js";
import {
  combinedPriceForBookieNearest,
  legPriceAtBookieNearest,
  type NearestBookieOpts,
} from "./nearest-bookie-line.js";

export type { NearestBookieOpts as BookiePriceOpts } from "./nearest-bookie-line.js";

function legsWithCanonPrices(legs: PickLeg[]): PickLeg[] {
  return legs.map((leg) => ({
    ...leg,
    bookiePrices: canonBookiePrices(leg.bookiePrices) as Record<string, number>,
  }));
}

export function legPriceAtBookie(leg: PickLeg, bookie: string): number | undefined {
  const canon = canonBookiePrices(leg.bookiePrices);
  const p = canon[bookie as keyof typeof canon];
  if (p == null || p <= 1) return undefined;
  return p;
}

/** Product of leg prices at one bookie; undefined if any leg missing. */
export function combinedPriceForBookie(
  legs: PickLeg[],
  bookie: string
): number | undefined {
  return combinedPriceForBookieWithCatalog(legs, bookie, legs);
}

export function combinedPriceForBookieWithCatalog(
  legs: PickLeg[],
  bookie: string,
  catalog: PickLeg[],
  opts?: NearestBookieOpts
): number | undefined {
  if (!legs.length) return undefined;
  const batch = combinedPriceForBookieNearest(legs, bookie, catalog, opts);
  return batch?.total;
}

export function legPriceAtBookieWithCatalog(
  leg: PickLeg,
  bookie: string,
  catalog: PickLeg[],
  opts?: NearestBookieOpts
): number | undefined {
  return legPriceAtBookieNearest(leg, bookie, catalog, opts);
}

export function legsMissingAtBookie(
  legs: PickLeg[],
  bookie: string,
  catalog: PickLeg[],
  opts?: NearestBookieOpts
): number {
  let n = 0;
  for (const leg of legs) {
    if (legPriceAtBookieWithCatalog(leg, bookie, catalog, opts) == null) n += 1;
  }
  return n;
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
  const priced = legsWithCanonPrices(legs);
  let best: SingleBookieQuote | undefined;
  for (const bookie of AU_BOOKMAKERS) {
    const price = combinedPriceForBookie(priced, bookie);
    if (price == null) continue;
    const everyLegAtTakeAt = priced.every((leg) => {
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