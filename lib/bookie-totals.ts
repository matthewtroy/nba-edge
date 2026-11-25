import type { PickLeg } from "./types.js";
import { AU_BOOKMAKERS } from "./types.js";
import { combinedPriceForBookie } from "./single-bookie.js";

const ALIASES: Record<string, (typeof AU_BOOKMAKERS)[number]> = {
  sportsbet: "Sportsbet",
  tab: "TAB",
  tabtouch: "TAB",
  unibet: "Unibet",
  pointsbet: "PointsBet",
  "pointsbet (au)": "PointsBet",
  ladbrokes: "Ladbrokes",
  neds: "Ladbrokes",
  betfair: "Betfair",
  bet365: "bet365",
};

function canonBookie(raw: string): (typeof AU_BOOKMAKERS)[number] | undefined {
  const key = raw.trim().toLowerCase();
  return ALIASES[key];
}

/** Merge raw API bookie names onto canonical AU book keys (max price per canon). */
export function canonBookiePrices(
  raw?: Record<string, number>
): Partial<Record<(typeof AU_BOOKMAKERS)[number], number>> {
  if (!raw) return {};
  const out: Partial<Record<(typeof AU_BOOKMAKERS)[number], number>> = {};
  for (const [name, price] of Object.entries(raw)) {
    const canon = canonBookie(name);
    if (!canon || price <= 1) continue;
    const prev = out[canon];
    if (prev == null || price > prev) out[canon] = price;
  }
  return out;
}

export function withSyntheticBookiePrices(leg: PickLeg): PickLeg {
  if (leg.bookiePrices && Object.keys(leg.bookiePrices).length) return leg;
  if (leg.bestPrice != null && leg.bestBookie) {
    return { ...leg, bookiePrices: { [leg.bestBookie]: leg.bestPrice } };
  }
  return leg;
}

export function multiBookieTotals(
  legs: PickLeg[]
): Partial<Record<(typeof AU_BOOKMAKERS)[number], number>> {
  const totals: Partial<Record<(typeof AU_BOOKMAKERS)[number], number>> = {};
  for (const book of AU_BOOKMAKERS) {
    const legsCanon = legs.map((leg) =>
      withSyntheticBookiePrices(leg)
    ).map((leg) => ({
      ...leg,
      bookiePrices: canonBookiePrices(leg.bookiePrices) as Record<string, number>,
    }));
    const price = combinedPriceForBookie(legsCanon, book);
    if (price != null) totals[book] = price;
  }
  return totals;
}