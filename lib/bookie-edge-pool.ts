import type { PickLeg } from "./types.js";
import { FEED_BOOKIES } from "./card-bookie.js";
import { legPriceAtBookie } from "./single-bookie.js";
import { multiBookieTotals } from "./bookie-totals.js";
import { edgeMultiplier } from "./multi-combined.js";

export function fairEdgeMultiplier(leg: PickLeg, minEdgeFraction: number): number {
  return leg.probability >= 0.7 ? 1.06 : edgeMultiplier(minEdgeFraction);
}

export function legMeetsBookieEdge(
  leg: PickLeg,
  bookie: string,
  minEdgeFraction: number
): boolean {
  const price = legPriceAtBookie(leg, bookie);
  if (price == null || price <= 1) return false;
  return price >= leg.fairPrice * fairEdgeMultiplier(leg, minEdgeFraction);
}

export function bookiesByCoverage(
  picks: PickLeg[],
  bookies: readonly string[] = FEED_BOOKIES
): string[] {
  const score = (bookie: string) =>
    picks.filter((l) => legPriceAtBookie(l, bookie) != null).length;
  return [...bookies].sort((a, b) => score(b) - score(a));
}

/** Use this bookie's price as leg.bestPrice for selection heuristics. */
export function asBookieLeg(leg: PickLeg, bookie: string): PickLeg | null {
  const price = legPriceAtBookie(leg, bookie);
  if (price == null) return null;
  return { ...leg, bestPrice: price, bestBookie: bookie };
}

export function overlayForBookie(
  legs: PickLeg[],
  bookie: string
): {
  bestBookie: string;
  bestBookieTotal: number;
  bookieTotals: Record<string, number>;
} {
  const priced = legs
    .map((l) => asBookieLeg(l, bookie))
    .filter(Boolean) as PickLeg[];
  const total = priced.reduce((acc, l) => acc * (l.bestPrice ?? 1), 1);
  return {
    bestBookie: bookie,
    bestBookieTotal: Math.round(total * 100) / 100,
    bookieTotals: multiBookieTotals(priced) as Record<string, number>,
  };
}