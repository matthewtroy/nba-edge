import type { PickLeg } from "./types.js";
import type { CatalogMarketIndex } from "./catalog-index.js";
import { FEED_BOOKIES } from "./card-bookie.js";
import { legPriceAtBookie } from "./single-bookie.js";
import { nearestPricedRung } from "./nearest-bookie-line.js";
import { multiBookieTotals } from "./bookie-totals.js";
import { bestEdgeMultiQuote } from "./best-multi-bookie.js";
import {
  bookieHighProbMeetsFair,
  bookiePriceMeetsMinEdge,
} from "./pricing-config.js";
import { edgeFairPrice } from "./leg-edge-fair.js";

export function legMeetsBookieEdge(
  leg: PickLeg,
  bookie: string,
  _minEdgeFraction?: number
): boolean {
  const price = legPriceAtBookie(leg, bookie);
  if (price == null || price <= 1) return false;
  const fair = edgeFairPrice(leg);
  if (bookiePriceMeetsMinEdge(price, fair)) return true;
  return bookieHighProbMeetsFair(price, fair, leg.probability);
}

export function bookiesByCoverage(
  picks: PickLeg[],
  bookies: readonly string[] = FEED_BOOKIES
): string[] {
  const score = (bookie: string) =>
    picks.filter((l) => legPriceAtBookie(l, bookie) != null).length;
  return [...bookies].sort((a, b) => score(b) - score(a));
}

/** Use this bookie's price (nearest main/alternate rung) as leg.bestPrice. */
export function asBookieLeg(
  leg: PickLeg,
  bookie: string,
  catalog?: PickLeg[],
  index?: CatalogMarketIndex
): PickLeg | null {
  const pool = catalog ?? [leg];
  const near = nearestPricedRung(leg, bookie, pool, { index });
  if (!near) return null;
  if (near.leg === leg && near.price === (leg.bestPrice ?? legPriceAtBookie(leg, bookie))) {
    return {
      ...leg,
      bestPrice: near.price,
      bestBookie: bookie,
      ...(near.lineShift ? { feedLineNote: near.lineShift } : {}),
    };
  }
  return {
    ...near.leg,
    bestPrice: near.price,
    bestBookie: bookie,
    feedLineNote: near.lineShift,
  };
}

/** Booster offered lines: price on feed odds only — no catalog nearest scan. */
export function asBookieLegOnDemand(
  leg: PickLeg,
  bookie: string,
  price: number
): PickLeg {
  return {
    ...leg,
    bestPrice: price,
    bestBookie: bookie,
  };
}

export function overlayForBookie(
  legs: PickLeg[],
  bookie: string,
  catalog?: PickLeg[],
  index?: CatalogMarketIndex,
  legQualifies?: (leg: PickLeg, candidate: string) => boolean
): {
  bestBookie: string;
  bestBookieTotal: number;
  bookieTotals: Record<string, number>;
} {
  const pool = catalog ?? legs;
  const priced = legs
    .map((l) => asBookieLeg(l, bookie, pool, index))
    .filter(Boolean) as PickLeg[];
  const buildTotal = priced.reduce((acc, l) => acc * (l.bestPrice ?? 1), 1);
  const bookieTotals = multiBookieTotals(legs) as Record<string, number>;
  const best = bestEdgeMultiQuote(legs, {
    buildBookie: bookie,
    catalog: pool,
    legQualifies,
  });
  return {
    bestBookie: best?.bookie ?? bookie,
    bestBookieTotal:
      best?.total ?? Math.round(buildTotal * 100) / 100,
    bookieTotals,
  };
}