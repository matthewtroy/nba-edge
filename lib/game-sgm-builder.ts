import type { PickLeg, SlateGame } from "./types.js";
import {
  combinedFairAndTakeAt,
  DEFAULT_MIN_EDGE,
} from "./multi-combined.js";
import {
  asBookieLeg,
  bookiesByCoverage,
} from "./bookie-edge-pool.js";
import {
  pickBestGamesTabSgmCombo,
  qualifiesGamesTabSgmLeg,
  plainEnglishGamesSgmReason,
  GAMES_TAB_MIN_LEGS,
  GAMES_TAB_MAX_LEGS,
  GAMES_TAB_MIN_LEG_PRICE,
} from "./games-tab-sgm.js";
import { qualifiesCrossBoostLeg } from "./main-play-eligibility.js";

export const MIN_GAME_SGM_LEG_PRICE = GAMES_TAB_MIN_LEG_PRICE;
export const MIN_GAME_SGM_LEGS = GAMES_TAB_MIN_LEGS;
export const MAX_GAME_SGM_LEGS = GAMES_TAB_MAX_LEGS;

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
  current: {
    p: number;
    total: number;
    legs: PickLeg[];
    bookie: string;
    edge: number;
    valueCount: number;
  } | null,
  next: {
    p: number;
    total: number;
    legs: PickLeg[];
    bookie: string;
    edge: number;
    valueCount: number;
  }
): boolean {
  if (!current) return true;
  if (Math.abs(next.p - current.p) > 1e-9) return next.p > current.p;
  if (next.valueCount !== current.valueCount) return next.valueCount > current.valueCount;
  if (Math.abs(next.edge - current.edge) > 1e-9) return next.edge > current.edge;
  return next.total > current.total;
}

export function pickGameSgmLegsWithReason(
  picks: PickLeg[],
  gameId: string,
  oddsMin: number,
  oddsMax: number,
  minEdgeFraction = DEFAULT_MIN_EDGE,
  catalog?: PickLeg[],
  gameLabel?: string
): GameSgmPickResult {
  const pool = catalog ?? picks;
  const eligible = picks
    .filter((l) => l.gameId === gameId && qualifiesCrossBoostLeg(l))
    .sort((a, b) => b.probability - a.probability);

  const label =
    gameLabel ??
    picks.find((l) => l.gameId === gameId)?.team ??
    gameId;
  const band = formatOddsBand(oddsMin, oddsMax);

  if (eligible.length < MIN_GAME_SGM_LEGS) {
    return {
      legs: [],
      bookie: "",
      total: 0,
      reason: plainEnglishGamesSgmReason(label, band, eligible.length, 0),
    };
  }

  let bestAcross: {
    legs: PickLeg[];
    bookie: string;
    p: number;
    total: number;
    edge: number;
    valueCount: number;
  } | null = null;
  let maxPool = 0;
  let maxPoolBookie = "";
  let inBandAttempts = 0;

  for (const bookie of bookiesByCoverage(eligible)) {
    const priced = eligible
      .filter((l) => qualifiesGamesTabSgmLeg(l, bookie, minEdgeFraction, pool))
      .map((l) => asBookieLeg(l, bookie, pool))
      .filter(Boolean) as PickLeg[];
    if (priced.length > maxPool) {
      maxPool = priced.length;
      maxPoolBookie = bookie;
    }
    if (priced.length < MIN_GAME_SGM_LEGS) continue;

    const combo = pickBestGamesTabSgmCombo(
      priced.slice(0, 22),
      bookie,
      pool,
      oddsMin,
      oddsMax
    );
    if (!combo) continue;
    inBandAttempts += 1;
    if (
      betterPick(
        bestAcross,
        {
          p: combo.p,
          total: combo.total,
          legs: combo.legs,
          bookie,
          edge: combo.edge,
          valueCount: combo.valueCount,
        }
      )
    ) {
      bestAcross = {
        legs: combo.legs,
        bookie,
        p: combo.p,
        total: combo.total,
        edge: combo.edge,
        valueCount: combo.valueCount,
      };
    }
  }

  if (!bestAcross) {
    void maxPoolBookie;
    return {
      legs: [],
      bookie: "",
      total: 0,
      reason: plainEnglishGamesSgmReason(
        label,
        band,
        maxPool,
        inBandAttempts
      ),
    };
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
  oddsMin = 1.5,
  oddsMax = 4,
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
  oddsMin: number,
  oddsMax: number,
  minEdgeFraction = DEFAULT_MIN_EDGE,
  catalog?: PickLeg[]
): GameSgmBuildResult {
  const short = `${game.awayTeam.split(" ").pop()} @ ${game.homeTeam.split(" ").pop()}`;
  const pick = pickGameSgmLegsWithReason(
    picks,
    game.id,
    oddsMin,
    oddsMax,
    minEdgeFraction,
    catalog ?? picks,
    short
  );
  if (!pick.legs.length) {
    return {
      game,
      notBuiltReason:
        pick.reason ??
        plainEnglishGamesSgmReason(short, formatOddsBand(oddsMin, oddsMax), 0, 0),
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