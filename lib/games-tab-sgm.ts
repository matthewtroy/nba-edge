import type { PickLeg } from "./types.js";
import { sameGameSgmHasClash } from "./clash.js";
import { pickSameGameLegSubsetResolved } from "./same-game-leg-resolve.js";
import { combinedPriceForBookieWithCatalog } from "./single-bookie.js";
import { legMeetsBookieEdge, asBookieLeg } from "./bookie-edge-pool.js";
import { qualifiesCrossBoostLeg } from "./main-play-eligibility.js";
import { passesFormGuard } from "./form-guard.js";
import { hasValueAtBookie } from "./value-at-bookie.js";
import { legEdgeDecimal } from "./same-game-sgm-search.js";

export const GAMES_TAB_MIN_LEG_PRICE = 1.3;
export const GAMES_TAB_MIN_LEGS = 2;
export const GAMES_TAB_MAX_LEGS = 6;
const HIGH_PROB_FAIR_RATIO = 0.97;
const HIGH_PROB_P = 0.7;

function combinedProb(legs: PickLeg[]): number {
  return legs.reduce((acc, l) => acc * l.probability, 1);
}

function totalInBand(total: number, min: number, max: number): boolean {
  if (!Number.isFinite(max)) return total >= min;
  return total >= min && total <= max;
}

export function qualifiesGamesTabSgmLeg(
  leg: PickLeg,
  bookie: string,
  minEdgeFraction: number,
  catalog?: PickLeg[]
): boolean {
  if (!passesFormGuard(leg)) return false;
  if (!qualifiesCrossBoostLeg(leg, bookie)) return false;
  const pool = catalog ?? [leg];
  const priced = asBookieLeg(leg, bookie, pool);
  if (!priced) return false;
  const price = priced.bestPrice ?? 0;
  if (price < GAMES_TAB_MIN_LEG_PRICE) return false;
  if (legMeetsBookieEdge(leg, bookie, minEdgeFraction)) return true;
  if (
    leg.probability >= HIGH_PROB_P &&
    price >= leg.fairPrice * HIGH_PROB_FAIR_RATIO
  ) {
    return true;
  }
  return false;
}

export function pickBestGamesTabSgmCombo(
  pool: PickLeg[],
  bookie: string,
  catalog: PickLeg[],
  oddsMin: number,
  oddsMax: number
): { legs: PickLeg[]; p: number; total: number; edge: number; valueCount: number } | null {
  if (pool.length < GAMES_TAB_MIN_LEGS) return null;

  let best: {
    legs: PickLeg[];
    p: number;
    total: number;
    edge: number;
    valueCount: number;
  } | null = null;

  function dfs(start: number, chosen: PickLeg[]) {
    if (
      chosen.length >= GAMES_TAB_MIN_LEGS &&
      chosen.length <= GAMES_TAB_MAX_LEGS
    ) {
      const total =
        combinedPriceForBookieWithCatalog(chosen, bookie, catalog) ?? 0;
      if (totalInBand(total, oddsMin, oddsMax) && !sameGameSgmHasClash(chosen)) {
        const p = combinedProb(chosen);
        const edge = chosen.reduce((s, l) => s + legEdgeDecimal(l), 0);
        const valueCount = chosen.filter((l) =>
          hasValueAtBookie(l, bookie)
        ).length;
        if (
          !best ||
          p > best.p ||
          (Math.abs(p - best.p) < 1e-9 && valueCount > best.valueCount) ||
          (Math.abs(p - best.p) < 1e-9 &&
            valueCount === best.valueCount &&
            edge > best.edge) ||
          (Math.abs(p - best.p) < 1e-9 &&
            valueCount === best.valueCount &&
            Math.abs(edge - best.edge) < 1e-9 &&
            total > best.total)
        ) {
          best = { legs: [...chosen], p, total, edge, valueCount };
        }
      }
    }
    if (chosen.length >= GAMES_TAB_MAX_LEGS) return;
    for (let i = start; i < pool.length; i++) {
      const next = [...chosen, pool[i]];
      if (sameGameSgmHasClash(next)) continue;
      dfs(i + 1, next);
    }
  }
  dfs(0, []);

  if (!best && pool.length >= GAMES_TAB_MIN_LEGS) {
    const resolved = pickSameGameLegSubsetResolved(
      pool,
      GAMES_TAB_MIN_LEGS,
      GAMES_TAB_MAX_LEGS,
      GAMES_TAB_MIN_LEG_PRICE
    );
    if (resolved) {
      const total =
        combinedPriceForBookieWithCatalog(resolved, bookie, catalog) ?? 0;
      if (totalInBand(total, oddsMin, oddsMax)) {
        const p = combinedProb(resolved);
        const edge = resolved.reduce((s, l) => s + legEdgeDecimal(l), 0);
        const valueCount = resolved.filter((l) => hasValueAtBookie(l, bookie))
          .length;
        best = { legs: resolved, p, total, edge, valueCount };
      }
    }
  }

  return best;
}

export function plainEnglishGamesSgmReason(
  gameLabel: string,
  bandLabel: string,
  eligibleCount: number,
  inBandAttempts: number
): string {
  if (eligibleCount < GAMES_TAB_MIN_LEGS) {
    return `${gameLabel}: not enough starter legs priced for this bookie band.`;
  }
  if (inBandAttempts === 0) {
    return `${gameLabel}: nothing fits ${bandLabel} after form and clash rules.`;
  }
  return `${gameLabel}: no ${GAMES_TAB_MIN_LEGS}–${GAMES_TAB_MAX_LEGS}-leg combo in ${bandLabel}.`;
}

export function crossGameExcludedReason(
  gameLabel: string,
  bookie: string,
  eligible: number
): string {
  if (eligible < 2) {
    return `${gameLabel}: need 2+ legs @ ${bookie} (found ${eligible}).`;
  }
  return `${gameLabel}: no clash-free 2–3 leg combo @ ${bookie}.`;
}