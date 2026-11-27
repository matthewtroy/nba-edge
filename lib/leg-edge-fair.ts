import type { PickLeg } from "./types.js";
import { LEG_BOOK_MIN_EDGE } from "./pricing-config.js";

/** Hits at this line in recentTenVsLine (up to 10 games, or fewer if logged). */
export function hitsAtLineSample(leg: PickLeg): { hits: number; n: number } | null {
  const ticks = leg.recentTenVsLine;
  if (!ticks?.length) return null;
  const hits = ticks.filter((t) => t === "hit").length;
  return { hits, n: ticks.length };
}

/** 1 / (hit rate at line); null when no sample. */
export function hitFairAtLine(leg: PickLeg): number | null {
  const sample = hitsAtLineSample(leg);
  if (!sample || sample.n < 1 || sample.hits < 1) return null;
  const rate = sample.hits / sample.n;
  if (rate <= 0) return null;
  return Math.round((1 / rate) * 100) / 100;
}

/** max(model fair, hit-implied fair) — eligibility only; display stays model fair. */
export function edgeFairPrice(leg: PickLeg): number {
  const hitFair = hitFairAtLine(leg);
  if (hitFair == null) return leg.fairPrice;
  return Math.max(leg.fairPrice, hitFair);
}

export function edgeFairTakeAt(leg: PickLeg): number {
  return Math.round(edgeFairPrice(leg) * (1 + LEG_BOOK_MIN_EDGE) * 100) / 100;
}