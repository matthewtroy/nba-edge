import type { PickLeg } from "./types.js";
import type { OddsCacheFile } from "./odds-cache-file.js";

export function oddsMapKeyCount(cache: Pick<OddsCacheFile, "oddsMap"> | null | undefined): number {
  return Object.keys(cache?.oddsMap ?? {}).length;
}

/** Block replacing a non-trivial cache with an empty or sharply smaller map unless force odds succeeded. */
export function oddsMapDowngradeBlocked(
  priorKeys: number,
  nextKeys: number,
  opts: { forceOddsPullSucceeded: boolean }
): boolean {
  if (opts.forceOddsPullSucceeded) return false;
  if (priorKeys <= 0) return false;
  if (nextKeys === 0) return true;
  if (nextKeys < priorKeys * 0.5) return true;
  return false;
}

export function countPricedPickLegs(picks: PickLeg[]): number {
  return picks.filter(
    (p) =>
      (p.bestPrice != null && p.bestPrice > 1) ||
      (p.bookiePrices != null &&
        Object.values(p.bookiePrices).some((v) => v != null && v > 1))
  ).length;
}

export function slateOddsSnapshotKeyCount(
  cache: Pick<import("./odds-cache-file.js").OddsCacheFile, "bySlateDate"> | null | undefined,
  slateDate: string
): number {
  return Object.keys(cache?.bySlateDate?.[slateDate]?.oddsMap ?? {}).length;
}

export function persistDataBranchGuardReason(opts: {
  defaultSlateDate: string | null;
  pricedLegs: number;
  /** Priced legs on the same slate folder in origin/data before this persist (0 if new). */
  priorPricedLegsOnSlate: number;
  /** Odds-map keys in bySlateDate[defaultSlateDate] prior vs next (like-with-like). */
  priorSlateCacheKeys: number;
  nextSlateCacheKeys: number;
  forceOdds: boolean;
}): string | null {
  if (opts.forceOdds) return null;
  if (opts.pricedLegs === 0 && opts.priorPricedLegsOnSlate > 0) {
    return `slate ${opts.defaultSlateDate ?? "?"} has 0 priced legs (was ${opts.priorPricedLegsOnSlate})`;
  }
  if (
    oddsMapDowngradeBlocked(opts.priorSlateCacheKeys, opts.nextSlateCacheKeys, {
      forceOddsPullSucceeded: false,
    })
  ) {
    return `odds-cache for slate ${opts.defaultSlateDate ?? "?"} would shrink ${opts.priorSlateCacheKeys} → ${opts.nextSlateCacheKeys} keys (>50% loss)`;
  }
  return null;
}

/** Merge global odds map without downgrading unless a successful force pull. */
export function mergeGlobalOddsMapRecord(
  prior: Record<string, { price: number; bookie: string }> | undefined,
  incoming: Record<string, { price: number; bookie: string }>,
  opts: { forceOddsPullSucceeded: boolean }
): Record<string, { price: number; bookie: string }> {
  const priorKeys = Object.keys(prior ?? {}).length;
  const nextKeys = Object.keys(incoming).length;
  if (oddsMapDowngradeBlocked(priorKeys, nextKeys, opts)) {
    return { ...(prior ?? {}) };
  }
  return { ...(prior ?? {}), ...incoming };
}