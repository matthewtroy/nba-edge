import type { Market, PickLeg } from "./types.js";
import { legPriceAtBookie } from "./single-bookie.js";
import { marketLabel } from "./market-label.js";

const MIN_NEAREST_P = 0.55;

export interface NearestBookieQuote {
  leg: PickLeg;
  price: number;
  /** e.g. "reb 5+ → 6+" when feed line differs */
  lineShift?: string;
}

function sameMarket(a: Market, b: Market): boolean {
  return a === b;
}

/** Closest priced rung at bookie (main + alternate), preferring p ≥ 0.55. */
export function nearestPricedRung(
  leg: PickLeg,
  bookie: string,
  catalog: PickLeg[]
): NearestBookieQuote | undefined {
  const exact = legPriceAtBookie(leg, bookie);
  if (exact != null && exact > 1) {
    return { leg, price: exact };
  }

  const siblings = catalog.filter(
    (p) =>
      p.playerId === leg.playerId &&
      sameMarket(p.market, leg.market) &&
      legPriceAtBookie(p, bookie) != null &&
      p.probability >= MIN_NEAREST_P
  );
  if (!siblings.length) return undefined;

  siblings.sort((a, b) => {
    const da = Math.abs(a.line - leg.line);
    const db = Math.abs(b.line - leg.line);
    if (da !== db) return da - db;
    return b.probability - a.probability;
  });

  const pick = siblings[0];
  const price = legPriceAtBookie(pick, bookie)!;
  const lineShift =
    pick.line !== leg.line
      ? `${marketLabel(leg.market, leg.line)} → ${marketLabel(pick.market, pick.line)}`
      : undefined;
  return { leg: pick, price, lineShift };
}

export function legPriceAtBookieNearest(
  leg: PickLeg,
  bookie: string,
  catalog?: PickLeg[]
): number | undefined {
  const exact = legPriceAtBookie(leg, bookie);
  if (exact != null) return exact;
  if (!catalog?.length) return undefined;
  return nearestPricedRung(leg, bookie, catalog)?.price;
}

export function combinedPriceForBookieNearest(
  legs: PickLeg[],
  bookie: string,
  catalog: PickLeg[]
): { total: number; quotes: NearestBookieQuote[] } | undefined {
  const quotes: NearestBookieQuote[] = [];
  let product = 1;
  for (const leg of legs) {
    const q = nearestPricedRung(leg, bookie, catalog);
    if (!q) return undefined;
    quotes.push(q);
    product *= q.price;
  }
  return { total: Math.round(product * 100) / 100, quotes };
}