import type { Market, PickLeg } from "./types.js";
import { legPriceAtBookie } from "./single-bookie.js";
import { withinNearestLineStep } from "./nearest-bookie-line.js";

export type CatalogMarketIndex = Map<string, PickLeg[]>;

export function catalogMarketKey(playerId: string, market: Market): string {
  return `${playerId}|${market}`;
}

/** Sorted ladder legs per player/market — built once per multis pass. */
export function buildCatalogMarketIndex(catalog: PickLeg[]): CatalogMarketIndex {
  const out: CatalogMarketIndex = new Map();
  for (const leg of catalog) {
    const key = catalogMarketKey(leg.playerId, leg.market);
    const arr = out.get(key) ?? [];
    arr.push(leg);
    out.set(key, arr);
  }
  for (const arr of out.values()) {
    arr.sort((a, b) => a.line - b.line);
  }
  return out;
}

export function ladderForPlayerMarket(
  index: CatalogMarketIndex,
  playerId: string,
  market: Market
): PickLeg[] {
  return index.get(catalogMarketKey(playerId, market)) ?? [];
}

export function nearestSiblingInIndex(
  leg: PickLeg,
  bookie: string,
  index: CatalogMarketIndex,
  minP = 0.55
): PickLeg | undefined {
  const exact = legPriceAtBookie(leg, bookie);
  if (exact != null && exact > 1) return leg;

  const siblings = ladderForPlayerMarket(index, leg.playerId, leg.market).filter(
    (p) =>
      withinNearestLineStep(leg, p) &&
      legPriceAtBookie(p, bookie) != null &&
      p.probability >= minP
  );
  if (!siblings.length) return undefined;

  siblings.sort((a, b) => {
    const da = Math.abs(a.line - leg.line);
    const db = Math.abs(b.line - leg.line);
    if (da !== db) return da - db;
    return b.probability - a.probability;
  });
  return siblings[0];
}