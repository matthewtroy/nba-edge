import type { PickLeg } from "./types.js";
import { AU_BOOKMAKERS } from "./types.js";
import { combinedPriceForBookie } from "./single-bookie.js";

/** Bookies with API odds in the feed (not manual-entry). */
export const FEED_BOOKIES = AU_BOOKMAKERS.filter((b) => b !== "bet365");

export function isFeedBookie(bookie?: string): boolean {
  return bookie != null && bookie !== "bet365";
}

export function bestFeedMultiQuote(
  legs: PickLeg[]
): { bookie: string; total: number } | undefined {
  let best: { bookie: string; total: number } | undefined;
  for (const bookie of FEED_BOOKIES) {
    const total = combinedPriceForBookie(legs, bookie);
    if (total == null) continue;
    if (!best || total > best.total) best = { bookie, total };
  }
  return best;
}

export function feedBookieForLeg(leg: PickLeg, cardBookie?: string): string | undefined {
  if (isFeedBookie(cardBookie)) return cardBookie;
  if (isFeedBookie(leg.bestBookie)) return leg.bestBookie;
  return undefined;
}

export const NO_FEED_MULTI_NOTE =
  "No single feed bookie prices every leg — type prices on legs";