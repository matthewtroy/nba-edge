import type { Market, PickLeg } from "./types.js";
import { legPriceAtBookie } from "./single-bookie.js";
import { marketLabel } from "./market-label.js";
import {
  type CatalogMarketIndex,
  ladderForPlayerMarket,
} from "./catalog-index.js";

const MIN_NEAREST_P = 0.55;

function maxLineStep(market: Market): number {
  if (market === "pts" || market === "q1pts") return 2;
  if (market === "reb" || market === "q1reb") return 1;
  if (market === "ast" || market === "q1ast") return 1;
  if (market === "3pm") return 1;
  return 1;
}

export function withinNearestLineStep(target: PickLeg, candidate: PickLeg): boolean {
  if (target.market !== candidate.market) return false;
  return Math.abs(candidate.line - target.line) <= maxLineStep(target.market);
}

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
  catalog: PickLeg[],
  opts?: { allowNearest?: boolean; index?: CatalogMarketIndex }
): NearestBookieQuote | undefined {
  if (opts?.allowNearest === false) {
    const exact = legPriceAtBookie(leg, bookie);
    if (exact != null && exact > 1) return { leg, price: exact };
    return undefined;
  }
  const exact = legPriceAtBookie(leg, bookie);
  if (exact != null && exact > 1) {
    return { leg, price: exact };
  }

  const ladder =
    opts?.index != null
      ? ladderForPlayerMarket(opts.index, leg.playerId, leg.market)
      : catalog.filter(
          (p) => p.playerId === leg.playerId && sameMarket(p.market, leg.market)
        );
  const siblings = ladder.filter(
    (p) =>
      withinNearestLineStep(leg, p) &&
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
  catalog?: PickLeg[],
  opts?: NearestBookieOpts
): number | undefined {
  const exact = legPriceAtBookie(leg, bookie);
  if (exact != null) return exact;
  if (!catalog?.length) return undefined;
  return nearestPricedRung(leg, bookie, catalog, opts)?.price;
}

export interface NearestBookieOpts {
  allowNearest?: boolean;
}

export function combinedPriceForBookieNearest(
  legs: PickLeg[],
  bookie: string,
  catalog: PickLeg[],
  opts?: NearestBookieOpts
): { total: number; quotes: NearestBookieQuote[] } | undefined {
  const quotes: NearestBookieQuote[] = [];
  let product = 1;
  for (const leg of legs) {
    const q = nearestPricedRung(leg, bookie, catalog, opts);
    if (!q) return undefined;
    quotes.push(q);
    product *= q.price;
  }
  return { total: Math.round(product * 100) / 100, quotes };
}