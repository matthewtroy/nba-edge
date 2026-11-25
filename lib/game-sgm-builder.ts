import type { PickLeg, SlateGame } from "./types.js";
import { multiHasClash } from "./clash.js";
import { qualifiesCrossBoostLeg } from "./main-play-eligibility.js";
import {
  combinedFairAndTakeAt,
  DEFAULT_MIN_EDGE,
} from "./multi-combined.js";
import {
  asBookieLeg,
  bookiesByCoverage,
  legMeetsBookieEdge,
} from "./bookie-edge-pool.js";
import { combinedPriceForBookie, legPriceAtBookie } from "./single-bookie.js";

export const MIN_GAME_SGM_LEG_PRICE = 1.5;
export const MIN_GAME_SGM_LEGS = 2;
export const MAX_GAME_SGM_LEGS = 6;

export interface GameSgmCard {
  game: SlateGame;
  legs: PickLeg[];
  fair: number;
  takeAt: number;
  bestBookie: string;
  bestTotal: number;
  oddsMin: number;
  oddsMax: number;
}

export interface GameSgmPickResult {
  legs: PickLeg[];
  bookie: string;
  total: number;
  reason?: string;
}

function combinedProb(legs: PickLeg[]): number {
  return legs.reduce((acc, l) => acc * l.probability, 1);
}

function betterPick(
  current: { p: number; total: number; legs: PickLeg[]; bookie: string } | null,
  next: { p: number; total: number; legs: PickLeg[]; bookie: string }
): boolean {
  if (!current) return true;
  if (Math.abs(next.p - current.p) > 1e-9) return next.p > current.p;
  return next.total > current.total;
}

function totalInBand(total: number, oddsMin: number, oddsMax: number): boolean {
  if (total < oddsMin) return false;
  if (!Number.isFinite(oddsMax)) return true;
  return total <= oddsMax;
}

export function pickGameSgmLegsWithReason(
  picks: PickLeg[],
  gameId: string,
  oddsMin = 4,
  oddsMax = 10,
  minEdgeFraction = DEFAULT_MIN_EDGE
): GameSgmPickResult {
  const eligible = picks
    .filter((l) => l.gameId === gameId && qualifiesCrossBoostLeg(l))
    .sort((a, b) => b.probability - a.probability);

  if (eligible.length < MIN_GAME_SGM_LEGS) {
    return {
      legs: [],
      bookie: "",
      total: 0,
      reason: `Need ${MIN_GAME_SGM_LEGS}+ starter main lines (${eligible.length} legs)`,
    };
  }

  let bestAcross: {
    legs: PickLeg[];
    bookie: string;
    p: number;
    total: number;
  } | null = null;
  let maxEdge = 0;
  let maxEdgeBookie = "";
  let maxRange = 0;

  for (const bookie of bookiesByCoverage(eligible)) {
    const edge = eligible.filter(
      (l) =>
        legMeetsBookieEdge(l, bookie, minEdgeFraction) &&
        (legPriceAtBookie(l, bookie) ?? 0) >= MIN_GAME_SGM_LEG_PRICE
    );
    const priced = edge.map((l) => asBookieLeg(l, bookie)).filter(Boolean) as PickLeg[];
    if (priced.length > maxEdge) {
      maxEdge = priced.length;
      maxEdgeBookie = bookie;
    }
    if (priced.length < MIN_GAME_SGM_LEGS) continue;

    const pool = priced.slice(0, 18);
    let bestForBookie: {
      legs: PickLeg[];
      p: number;
      total: number;
    } | null = null;
    let rangeCands = 0;

    function dfs(start: number, chosen: PickLeg[]) {
      if (chosen.length >= MIN_GAME_SGM_LEGS) {
        const total = combinedPriceForBookie(chosen, bookie) ?? 0;
        if (totalInBand(total, oddsMin, oddsMax) && !multiHasClash(chosen)) {
          rangeCands += 1;
          const p = combinedProb(chosen);
          const candidate = { legs: [...chosen], p, total };
          if (
            !bestForBookie ||
            candidate.p > bestForBookie.p ||
            (Math.abs(candidate.p - bestForBookie.p) < 1e-9 &&
              candidate.total > bestForBookie.total)
          ) {
            bestForBookie = candidate;
          }
        }
      }
      if (chosen.length >= MAX_GAME_SGM_LEGS) return;
      for (let i = start; i < pool.length; i++) {
        const next = [...chosen, pool[i]];
        if (multiHasClash(next)) continue;
        dfs(i + 1, next);
      }
    }
    dfs(0, []);

    maxRange = Math.max(maxRange, rangeCands);
    if (!bestForBookie) continue;
    const pick = bestForBookie;
    if (
      betterPick(
        bestAcross
          ? {
              p: bestAcross.p,
              total: bestAcross.total,
              legs: bestAcross.legs,
              bookie: bestAcross.bookie,
            }
          : null,
        {
          p: pick.p,
          total: pick.total,
          legs: pick.legs,
          bookie,
        }
      )
    ) {
      bestAcross = { legs: pick.legs, bookie, p: pick.p, total: pick.total };
    }
  }

  if (!bestAcross) {
    const band = formatOddsBand(oddsMin, oddsMax);
    const reason = `No ${MIN_GAME_SGM_LEGS}–${MAX_GAME_SGM_LEGS}-leg SGM @ edge in ${band} (eligible ${eligible.length}, best pool ${maxEdgeBookie}=${maxEdge}, range-cands ${maxRange})`;
    return { legs: [], bookie: "", total: 0, reason };
  }

  return {
    legs: bestAcross.legs,
    bookie: bestAcross.bookie,
    total: bestAcross.total,
  };
}

export function pickGameSgmLegs(
  picks: PickLeg[],
  gameId: string,
  oddsMin = 4,
  oddsMax = 10,
  minEdgeFraction = DEFAULT_MIN_EDGE
): PickLeg[] | null {
  const result = pickGameSgmLegsWithReason(
    picks,
    gameId,
    oddsMin,
    oddsMax,
    minEdgeFraction
  );
  return result.legs.length ? result.legs : null;
}

export function formatOddsBand(oddsMin: number, oddsMax: number): string {
  if (!Number.isFinite(oddsMax)) {
    return `$${oddsMin.toFixed(1)}–50+`;
  }
  return `$${oddsMin.toFixed(1)}–${oddsMax.toFixed(0)}`;
}

export type GameSgmBuildResult =
  | GameSgmCard
  | { game: SlateGame; notBuiltReason: string; oddsMin: number; oddsMax: number };

export function isGameSgmCard(r: GameSgmBuildResult): r is GameSgmCard {
  return "legs" in r && "fair" in r;
}

export function buildGameSgmCard(
  game: SlateGame,
  picks: PickLeg[],
  oddsMin = 4,
  oddsMax = 10,
  minEdgeFraction = DEFAULT_MIN_EDGE
): GameSgmBuildResult {
  const pick = pickGameSgmLegsWithReason(
    picks,
    game.id,
    oddsMin,
    oddsMax,
    minEdgeFraction
  );
  if (!pick.legs.length) {
    return {
      game,
      notBuiltReason:
        pick.reason ??
        `No game SGM in ${formatOddsBand(oddsMin, oddsMax)}`,
      oddsMin,
      oddsMax,
    };
  }
  const legs = pick.legs;
  const { fair, takeAt } = combinedFairAndTakeAt(legs, minEdgeFraction);
  return {
    game,
    legs,
    fair,
    takeAt,
    bestBookie: pick.bookie,
    bestTotal: pick.total,
    oddsMin,
    oddsMax,
  };
}