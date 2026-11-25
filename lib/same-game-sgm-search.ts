import type { PickLeg } from "./types.js";
import { sameGameSgmHasClash } from "./clash.js";
import { pickSameGameLegSubsetResolved } from "./same-game-leg-resolve.js";
import { combinedPriceForBookieWithCatalog } from "./single-bookie.js";
import { legMeetsBookieEdge } from "./bookie-edge-pool.js";
import { qualifiesCrossBoostLeg } from "./main-play-eligibility.js";

export const SGM_BAND_MIN = 7;
export const SGM_BAND_MAX = 15;
export const SGM_MIN_LEGS = 3;
export const SGM_MAX_LEGS = 4;
export const SGM_MIN_LEG_PRICE = 1.3;

function combinedProb(legs: PickLeg[]): number {
  return legs.reduce((acc, l) => acc * l.probability, 1);
}

export function legEdgeDecimal(leg: PickLeg): number {
  if (leg.bestPrice == null) return 0;
  return leg.bestPrice - leg.takeAt;
}

function totalInBand(total: number, min = SGM_BAND_MIN, max = SGM_BAND_MAX): boolean {
  return total >= min && total <= max;
}

export function pickBestSameGameSgmCombo(
  pool: PickLeg[],
  bookie: string,
  catalog: PickLeg[],
  oddsMin = SGM_BAND_MIN,
  oddsMax = SGM_BAND_MAX
): { legs: PickLeg[]; p: number; total: number; edge: number } | null {
  if (pool.length < SGM_MIN_LEGS) return null;

  let best: { legs: PickLeg[]; p: number; total: number; edge: number } | null = null;

  function dfs(start: number, chosen: PickLeg[]) {
    if (chosen.length >= SGM_MIN_LEGS && chosen.length <= SGM_MAX_LEGS) {
      const total = combinedPriceForBookieWithCatalog(chosen, bookie, catalog) ?? 0;
      if (totalInBand(total, oddsMin, oddsMax) && !sameGameSgmHasClash(chosen)) {
        const p = combinedProb(chosen);
        const edge = chosen.reduce((s, l) => s + legEdgeDecimal(l), 0);
        if (
          !best ||
          p > best.p ||
          (Math.abs(p - best.p) < 1e-9 && edge > best.edge) ||
          (Math.abs(p - best.p) < 1e-9 &&
            Math.abs(edge - best.edge) < 1e-9 &&
            total > best.total)
        ) {
          best = { legs: [...chosen], p, total, edge };
        }
      }
    }
    if (chosen.length >= SGM_MAX_LEGS) return;
    for (let i = start; i < pool.length; i++) {
      const next = [...chosen, pool[i]];
      if (sameGameSgmHasClash(next)) continue;
      dfs(i + 1, next);
    }
  }
  dfs(0, []);

  return best;
}

const CROSS_MIN_LEGS = 2;
const CROSS_MAX_LEGS = 3;

/** Best 2–3 leg same-game subset for cross-game multis (clash resolve: keep higher p). */
export function pickBestCrossGameLegSubset(pool: PickLeg[]): PickLeg[] | null {
  return pickSameGameLegSubsetResolved(
    pool,
    CROSS_MIN_LEGS,
    CROSS_MAX_LEGS,
    SGM_MIN_LEG_PRICE
  );
}

export function gameSgmEligibleAtBookie(
  picks: PickLeg[],
  gameId: string,
  bookie: string,
  catalog: PickLeg[],
  minEdgeFraction: number
): PickLeg[] {
  return picks
    .filter(
      (l) =>
        l.gameId === gameId &&
        qualifiesCrossBoostLeg(l, bookie) &&
        legMeetsBookieEdge(l, bookie, minEdgeFraction)
    )
    .filter((l) => (l.bestPrice ?? 0) >= SGM_MIN_LEG_PRICE);
}