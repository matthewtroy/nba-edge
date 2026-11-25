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

export interface MultiCardTitleOptions {
  fairOnly?: boolean;
  fairOnlyNote?: string;
  minEdgeFraction?: number;
}

function resolveTitleOpts(
  minEdgeOrOpts: number | MultiCardTitleOptions
): MultiCardTitleOptions {
  return typeof minEdgeOrOpts === "number"
    ? { minEdgeFraction: minEdgeOrOpts }
    : minEdgeOrOpts;
}

export function multiCardTitle(
  multi: MultiBet,
  legs: PickLeg[],
  minEdgeOrOpts: number | MultiCardTitleOptions = DEFAULT_MIN_EDGE
): { headline: string; subline: string; cardBookie: string; fairOnly: boolean } {
  const opts = resolveTitleOpts(minEdgeOrOpts);
  const minEdge = opts.minEdgeFraction ?? DEFAULT_MIN_EDGE;
  const { fair } = combinedFairAndTakeAt(legs, minEdge);
  const name = multi.variant ? `${multi.label} (${multi.variant})` : multi.label;
  const q1Note = "No bookie feed for Q1: compare with your bookie's price";

  if (opts.fairOnly === true || multi.type === "q1Multi") {
    const takeAt = Math.round(fair * edgeMultiplier(minEdge) * 100) / 100;
    const subline =
      multi.type === "q1Multi"
        ? `Take $${takeAt.toFixed(2)} (fair×1.08) · ${q1Note}`
        : opts.fairOnlyNote ?? `Fair $${fair.toFixed(2)}`;
  return {
      headline: `${name} @ take $${takeAt.toFixed(2)}`,
      subline,
      cardBookie: "",
      fairOnly: true,
    };
  }

  let total: number;
  let cardBookie = multi.bestBookie ?? "";
  try {
    const feed = resolveMultiFeedQuote(multi, legs);
    total = feed.total;
    cardBookie = feed.bookie;
  } catch {
    const subline = opts.fairOnlyNote ?? "Fair model only — no bookmaker feed yet";
    return {
      headline: `${name}: Fair $${fair.toFixed(2)}`,
      subline,
      cardBookie: "",
      fairOnly: true,
    };
  }
  return {
    headline: name,
    subline: cardBookie,
    cardBookie,
    fairOnly: false,
  };
}

/** @deprecated use formatLegCardLine — kept for any non-card callers */
export function legOddsDisplayLine(leg: PickLeg, cardBookie?: string): string {
  if (!cardBookie) return `${leg.playerName} · Fair $${leg.fairPrice.toFixed(2)}`;
  const p = legPriceAtBookie(leg, cardBookie);
  if (p == null) return `${leg.playerName} · Fair $${leg.fairPrice.toFixed(2)}`;
  return `$${p.toFixed(2)} · ${cardBookie} · Fair $${leg.fairPrice.toFixed(2)}`;
}