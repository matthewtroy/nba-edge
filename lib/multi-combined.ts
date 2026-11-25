import type { MultiBet, PickLeg } from "./types.js";
import {
  bestFeedMultiQuote,
  feedBookieForLeg,
  NO_FEED_MULTI_NOTE,
} from "./card-bookie.js";
import { legPriceAtBookie } from "./single-bookie.js";

export const DEFAULT_MIN_EDGE = 0.08;

export function edgeMultiplier(minEdgeFraction = DEFAULT_MIN_EDGE): number {
  return 1 + minEdgeFraction;
}

export function combinedFairAndTakeAt(
  legs: PickLeg[],
  minEdgeFraction = DEFAULT_MIN_EDGE
): { p: number; fair: number; takeAt: number } {
  const p = legs.reduce((acc, l) => acc * l.probability, 1);
  const fair = Math.round((1 / p) * 100) / 100;
  const takeAt = Math.round(fair * edgeMultiplier(minEdgeFraction) * 100) / 100;
  return { p, fair, takeAt };
}

export function legOddsDisplayLine(leg: PickLeg, cardBookie?: string): string {
  const feed = feedBookieForLeg(leg, cardBookie);
  const parts: string[] = [];
  if (feed) {
    const bookPx = legPriceAtBookie(leg, feed);
    if (bookPx != null) parts.push(`$${bookPx.toFixed(2)}`);
    else parts.push("Not offered");
  }
  if (leg.bestPrice != null && leg.bestBookie && leg.bestBookie !== "bet365") {
    parts.push(`best: ${leg.bestBookie} $${leg.bestPrice.toFixed(2)}`);
  }
  parts.push(`take at $${leg.takeAt.toFixed(2)}+`);
  return parts.join(" · ");
}

export function multiCardTitle(
  multi: MultiBet,
  legs: PickLeg[],
  minEdgeFraction = DEFAULT_MIN_EDGE
): { headline: string; subline: string } {
  const { fair, takeAt } = combinedFairAndTakeAt(legs, minEdgeFraction);
  const name = multi.variant ? `${multi.label} (${multi.variant})` : multi.label;
  const feed =
    multi.bestBookie && multi.bestBookie !== "bet365" && multi.bestBookieTotal != null
      ? { bookie: multi.bestBookie, total: multi.bestBookieTotal }
      : bestFeedMultiQuote(legs);
  if (feed && feed.total > 1) {
    return {
      headline: `${name} @ $${feed.total.toFixed(2)}`,
      subline: `${feed.bookie} · take at $${takeAt.toFixed(2)}+ (fair $${fair.toFixed(2)})`,
    };
  }
  return {
    headline: `${name} @ —`,
    subline: `take at $${takeAt.toFixed(2)}+ (fair $${fair.toFixed(2)}) · ${NO_FEED_MULTI_NOTE}`,
  };
}