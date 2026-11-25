import type { PickLeg, SlateGame } from "./types.js";
import { multiHasClash } from "./clash.js";
import { qualifiesCrossBoostLeg } from "./main-play-eligibility.js";
import { combinedFairAndTakeAt, DEFAULT_MIN_EDGE } from "./multi-combined.js";
import { bestFeedMultiQuote } from "./card-bookie.js";

export interface GameSgmCard {
  game: SlateGame;
  legs: PickLeg[];
  fair: number;
  takeAt: number;
  bestBookie?: string;
  bestTotal?: number;
  fairMin: number;
  fairMax: number;
}

export function pickGameSgmLegs(
  picks: PickLeg[],
  gameId: string,
  fairMin = 4,
  fairMax = 10,
  legCount = 3
): PickLeg[] | null {
  const pool = picks
    .filter((l) => l.gameId === gameId && qualifiesCrossBoostLeg(l))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 18);

  if (pool.length < legCount) return null;

  let best: PickLeg[] | null = null;
  let bestFair = 0;

  function dfs(start: number, chosen: PickLeg[]) {
    if (chosen.length === legCount) {
      if (multiHasClash(chosen)) return;
      const { fair } = combinedFairAndTakeAt(chosen, DEFAULT_MIN_EDGE);
      if (fair >= fairMin && fair <= fairMax && fair > bestFair) {
        bestFair = fair;
        best = [...chosen];
      }
      return;
    }
    for (let i = start; i < pool.length; i++) {
      const next = [...chosen, pool[i]];
      if (multiHasClash(next)) continue;
      dfs(i + 1, next);
    }
  }
  dfs(0, []);

  return best;
}

export function buildGameSgmCard(
  game: SlateGame,
  picks: PickLeg[],
  fairMin = 4,
  fairMax = 10
): GameSgmCard | null {
  const legs = pickGameSgmLegs(picks, game.id, fairMin, fairMax, 3);
  if (!legs?.length) return null;
  const { fair, takeAt } = combinedFairAndTakeAt(legs, DEFAULT_MIN_EDGE);
  const feed = bestFeedMultiQuote(legs);
  return {
    game,
    legs,
    fair,
    takeAt,
    bestBookie: feed?.bookie,
    bestTotal: feed?.total,
    fairMin,
    fairMax,
  };
}