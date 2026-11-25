import type { PickLeg, SlateGame } from "./types.js";
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
import {
  pickBestSameGameSgmCombo,
  SGM_BAND_MIN,
  SGM_BAND_MAX,
  SGM_MIN_LEGS,
  SGM_MAX_LEGS,
} from "./same-game-sgm-search.js";

export const MIN_GAME_SGM_LEG_PRICE = 1.3;
export const MIN_GAME_SGM_LEGS = SGM_MIN_LEGS;
export const MAX_GAME_SGM_LEGS = SGM_MAX_LEGS;

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

function betterPick(
  current: { p: number; total: number; legs: PickLeg[]; bookie: string; edge: number } | null,
  next: { p: number; total: number; legs: PickLeg[]; bookie: string; edge: number }
): boolean {
  if (!current) return true;
  if (Math.abs(next.p - current.p) > 1e-9) return next.p > current.p;
  if (Math.abs(next.edge - current.edge) > 1e-9) return next.edge > current.edge;
  return next.total > current.total;
}

export function pickGameSgmLegsWithReason(
  picks: PickLeg[],
  gameId: string,
  oddsMin = SGM_BAND_MIN,
  oddsMax = SGM_BAND_MAX,
  minEdgeFraction = DEFAULT_MIN_EDGE,
  catalog?: PickLeg[]
): GameSgmPickResult {
  const pool = catalog ?? picks;
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
    edge: number;
  } | null = null;
  let maxEdge = 0;
  let maxEdgeBookie = "";
  let maxRange = 0;

  for (const bookie of bookiesByCoverage(eligible)) {
    let priced = eligible
      .filter((l) => legMeetsBookieEdge(l, bookie, minEdgeFraction))
      .map((l) => asBookieLeg(l, bookie, pool))
      .filter(Boolean) as PickLeg[];
    priced = priced.filter((l) => (l.bestPrice ?? 0) >= MIN_GAME_SGM_LEG_PRICE);
    if (priced.length > maxEdge) {
      maxEdge = priced.length;
      maxEdgeBookie = bookie;
    }
    if (priced.length < MIN_GAME_SGM_LEGS) continue;

    const combo = pickBestSameGameSgmCombo(
      priced.slice(0, 20),
      bookie,
      pool,
      oddsMin,
      oddsMax
    );
    if (!combo) continue;
    maxRange += 1;
    if (
      betterPick(
        bestAcross
          ? {
              p: bestAcross.p,
              total: bestAcross.total,
              legs: bestAcross.legs,
              bookie: bestAcross.bookie,
              edge: bestAcross.edge,
            }
          : null,
        {
          p: combo.p,
          total: combo.total,
          legs: combo.legs,
          bookie,
          edge: combo.edge,
        }
      )
    ) {
      bestAcross = {
        legs: combo.legs,
        bookie,
        p: combo.p,
        total: combo.total,
        edge: combo.edge,
      };
    }
  }

  if (!bestAcross) {
    const band = formatOddsBand(oddsMin, oddsMax);
    const reason = `No ${MIN_GAME_SGM_LEGS}–${MAX_GAME_SGM_LEGS}-leg SGM in ${band} @ edge (eligible ${eligible.length}, best pool ${maxEdgeBookie}=${maxEdge}, in-band ${maxRange})`;
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
  oddsMin = SGM_BAND_MIN,
  oddsMax = SGM_BAND_MAX,
  minEdgeFraction = DEFAULT_MIN_EDGE,
  catalog?: PickLeg[]
): PickLeg[] | null {
  const result = pickGameSgmLegsWithReason(
    picks,
    gameId,
    oddsMin,
    oddsMax,
    minEdgeFraction,
    catalog
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
  oddsMin = SGM_BAND_MIN,
  oddsMax = SGM_BAND_MAX,
  minEdgeFraction = DEFAULT_MIN_EDGE,
  catalog?: PickLeg[]
): GameSgmBuildResult {
  const pick = pickGameSgmLegsWithReason(
    picks,
    game.id,
    oddsMin,
    oddsMax,
    minEdgeFraction,
    catalog ?? picks
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