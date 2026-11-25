import type { MultiBet, PickLeg } from "./types.js";
import { bestFeedMultiQuote } from "./card-bookie.js";
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

export function resolveMultiFeedQuote(
  multi: MultiBet,
  legs: PickLeg[]
): { bookie: string; total: number } {
  const fromMulti =
    multi.bestBookie && multi.bestBookieTotal != null
      ? { bookie: multi.bestBookie, total: multi.bestBookieTotal }
      : undefined;
  const feed = fromMulti ?? bestFeedMultiQuote(legs);
  if (!feed || feed.total <= 1) {
    throw new Error("multiCardTitle: multi missing AU bookie total");
  }
  return feed;
}

export function multiCardTitle(
  multi: MultiBet,
  legs: PickLeg[],
  minEdgeFraction = DEFAULT_MIN_EDGE
): { headline: string; subline: string; cardBookie: string } {
  const { fair } = combinedFairAndTakeAt(legs, minEdgeFraction);
  const name = multi.variant ? `${multi.label} (${multi.variant})` : multi.label;
  let total: number;
  let cardBookie = multi.bestBookie ?? "";
  try {
    const feed = resolveMultiFeedQuote(multi, legs);
    total = feed.total;
    cardBookie = feed.bookie;
  } catch {
    total = combinedFairAndTakeAt(legs, minEdgeFraction).takeAt;
  }
  const subline = cardBookie || `Fair $${fair.toFixed(2)}`;
  return {
    headline: `${name}: $${total.toFixed(2)}`,
    subline,
    cardBookie,
  };
}

/** @deprecated use formatLegCardLine — kept for any non-card callers */
export function legOddsDisplayLine(leg: PickLeg, cardBookie?: string): string {
  if (!cardBookie) return `${leg.playerName} · Fair $${leg.fairPrice.toFixed(2)}`;
  const p = legPriceAtBookie(leg, cardBookie);
  if (p == null) return `${leg.playerName} · Fair $${leg.fairPrice.toFixed(2)}`;
  return `$${p.toFixed(2)} · ${cardBookie} · Fair $${leg.fairPrice.toFixed(2)}`;
}