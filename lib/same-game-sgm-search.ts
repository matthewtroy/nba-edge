import type { PickLeg } from "./types.js";
import { legsClash, multiHasClash, sameGameSgmLegsClash } from "./clash.js";
import { pickMultiLegSubsetResolved } from "./same-game-leg-resolve.js";
import { combinedPriceForBookieWithCatalog } from "./single-bookie.js";
import { legMeetsBookieEdge } from "./bookie-edge-pool.js";
import { qualifiesCrossBoostLeg } from "./main-play-eligibility.js";
import {
  actualEdgeFraction,
  edgeSurplus,
  formatEdgeShortfall,
  requiredEdge,
} from "./pricing-config.js";

export const SGM_BAND_MIN = 7;
export const SGM_BAND_MAX = 15;
/** Minimum games with at least one cross leg @ one bookie, or not built. */
export const CROSS_SGM_MIN_GAMES = 2;
export const CROSS_LEGS_PER_GAME = 2;
export const SGM_MIN_LEGS = 2;
export const SGM_MAX_LEGS = 5;
export const SGM_MIN_LEG_PRICE = 1.3;

/** Best SGM: floor $2, no upper combined limit. */
export const SGM_NO_ODDS_MIN = 2;
export const SGM_NO_ODDS_MAX = Number.POSITIVE_INFINITY;

function combinedProb(legs: PickLeg[]): number {
  return legs.reduce((acc, l) => acc * l.probability, 1);
}

export function legEdgeDecimal(leg: PickLeg): number {
  if (leg.bestPrice == null) return 0;
  return leg.bestPrice - leg.takeAt;
}

function totalInBand(total: number, min = SGM_NO_ODDS_MIN, max = SGM_NO_ODDS_MAX): boolean {
  if (!Number.isFinite(max)) return total >= min;
  return total >= min && total <= max;
}

export type SameGameSgmCombo = {
  legs: PickLeg[];
  p: number;
  total: number;
  edge: number;
  surplus: number;
};

export function pickBestSameGameSgmCombo(
  pool: PickLeg[],
  bookie: string,
  catalog: PickLeg[],
  oddsMin = SGM_NO_ODDS_MIN,
  oddsMax = SGM_NO_ODDS_MAX
): SameGameSgmCombo | null {
  if (pool.length < SGM_MIN_LEGS) return null;

  const holder: { best: SameGameSgmCombo | null } = { best: null };

  function consider(chosen: PickLeg[]) {
    const total = combinedPriceForBookieWithCatalog(chosen, bookie, catalog) ?? 0;
    if (!totalInBand(total, oddsMin, oddsMax) || multiHasClash(chosen)) return;
    const p = combinedProb(chosen);
    const fair = 1 / p;
    const actual = actualEdgeFraction(total, fair);
    const req = requiredEdge(total);
    if (actual + 1e-12 < req) return;
    const surplus = edgeSurplus(total, fair);
    const edge = chosen.reduce((s, l) => s + legEdgeDecimal(l), 0);
    const cur = holder.best;
    if (
      !cur ||
      surplus > cur.surplus + 1e-12 ||
      (Math.abs(surplus - cur.surplus) < 1e-12 && p > cur.p + 1e-12) ||
      (Math.abs(surplus - cur.surplus) < 1e-12 &&
        Math.abs(p - cur.p) < 1e-12 &&
        edge > cur.edge)
    ) {
      holder.best = { legs: [...chosen], p, total, edge, surplus };
    }
  }

  function dfs(start: number, chosen: PickLeg[]) {
    if (chosen.length >= SGM_MIN_LEGS && chosen.length <= SGM_MAX_LEGS) {
      consider(chosen);
    }
    if (chosen.length >= SGM_MAX_LEGS) return;
    for (let i = start; i < pool.length; i++) {
      const next = [...chosen, pool[i]];
      if (multiHasClash(next)) continue;
      dfs(i + 1, next);
    }
  }
  dfs(0, []);

  if (!holder.best && pool.length >= SGM_MIN_LEGS) {
    const resolved = pickMultiLegSubsetResolved(
      pool,
      SGM_MIN_LEGS,
      SGM_MAX_LEGS,
      SGM_MIN_LEG_PRICE
    );
    if (resolved) consider(resolved);
  }

  return holder.best;
}

/** Shortfall string for a combo that is in the $2+ band but under the edge curve. */
export function sameGameSgmEdgeShortfall(
  total: number,
  combinedFair: number
): string | null {
  const actual = actualEdgeFraction(total, combinedFair);
  const req = requiredEdge(total);
  if (actual + 1e-12 >= req) return null;
  return formatEdgeShortfall(total, actual, req);
}

/** Best 2-leg same-game pair for cross-game multis — max joint p, different players, Best SGM clash rules only. */
export function pickBestCrossGameLegPair(pool: PickLeg[]): PickLeg[] | null {
  let best: { legs: PickLeg[]; p: number } | null = null;
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i];
      const b = pool[j];
      if (a.playerId === b.playerId) continue;
      const pair = [a, b];
      if (sameGameSgmLegsClash(a, b)) continue;
      const p = a.probability * b.probability;
      if (
        !best ||
        p > best.p + 1e-12 ||
        (Math.abs(p - best.p) < 1e-12 &&
          (a.bestPrice ?? 0) * (b.bestPrice ?? 0) >
            (best.legs[0].bestPrice ?? 0) * (best.legs[1].bestPrice ?? 0))
      ) {
        best = { legs: pair, p };
      }
    }
  }
  return best?.legs ?? null;
}

/** Prefer a 2-leg pair; otherwise highest-probability single leg. */
export function pickCrossGameLegsForGame(pool: PickLeg[]): PickLeg[] | null {
  const pair = pickBestCrossGameLegPair(pool);
  if (pair?.length === CROSS_LEGS_PER_GAME) return pair;
  if (!pool.length) return null;
  const sorted = [...pool].sort((a, b) => {
    const dp = b.probability - a.probability;
    if (Math.abs(dp) > 1e-12) return dp;
    return legEdgeDecimal(b) - legEdgeDecimal(a);
  });
  return [sorted[0]!];
}

/** @deprecated use pickBestCrossGameLegPair */
export function pickBestCrossGameLegSubset(pool: PickLeg[]): PickLeg[] | null {
  return pickBestCrossGameLegPair(pool);
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
