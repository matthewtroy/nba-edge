import type { PickLeg, SlateGame } from "./types.js";
import type { OfficialLegSnapshot } from "./official-card-time.js";
import { buildGameSgmCard, isGameSgmCard, type GameSgmCard } from "./game-sgm-builder.js";
import { GAMES_TAB_SGM_RULES } from "./games-tab-sgm.js";
import { GAMES_SGM_PRESETS } from "./games-sgm-presets.js";
import { gameSgmAsMulti, gameShortLabel } from "./games-sgm-ui.js";
import { officialStakeUnits } from "./pricing-config.js";
import {
  settleMultiLegs,
  voidAdjustedPrice,
  type CardBetResult,
  type CardLegResult,
} from "./settle-core.js";
import { legPriceAtBookie } from "./single-bookie.js";
import { freezeOfficialLegSnapshots, pickLegFromSnapshot } from "./official-leg-snapshot.js";
import { profitUnitsForBet } from "./official-bet-settle.js";

/** One Games-tab SGM frozen at publish for a game and price filter (Roughies off). */
export interface FrozenGamesSgm {
  gameId: string;
  game: string;
  filter: string;
  legs: string[];
  bookie: string;
  total: number;
  fair: number;
  takeAt: number;
  stakeUnits: number;
}

export interface FrozenGamesSgmNotBuilt {
  gameId: string;
  filter: string;
  reason: string;
}

export interface FrozenGamesSgms {
  bets: FrozenGamesSgm[];
  notBuilt: FrozenGamesSgmNotBuilt[];
  legSnapshots: Record<string, OfficialLegSnapshot>;
}

export function freezeGamesSgms(slate: SlateGame[], picks: PickLeg[]): FrozenGamesSgms {
  const bets: FrozenGamesSgm[] = [];
  const notBuilt: FrozenGamesSgmNotBuilt[] = [];
  const multis = [];
  for (const game of slate) {
    for (const preset of GAMES_SGM_PRESETS) {
      const built = buildGameSgmCard(
        game,
        picks,
        preset.min,
        preset.max,
        undefined,
        picks,
        GAMES_TAB_SGM_RULES
      );
      if (!isGameSgmCard(built)) {
        notBuilt.push({ gameId: game.id, filter: preset.label, reason: built.notBuiltReason });
        continue;
      }
      bets.push({
        gameId: game.id,
        game: gameShortLabel(game),
        filter: preset.label,
        legs: built.legs.map((l) => l.id),
        bookie: built.bestBookie,
        total: built.bestTotal,
        fair: built.fair,
        takeAt: built.takeAt,
        stakeUnits: officialStakeUnits("gamesSgm", built.bestTotal),
      });
      multis.push(gameSgmAsMulti(built, game));
    }
  }
  const picksById = new Map(picks.map((p) => [p.id, p]));
  return { bets, notBuilt, legSnapshots: freezeOfficialLegSnapshots(multis, picksById, picks) };
}

/** Games-tab blocks for one filter from the publish freeze (no rebuild after 9pm). */
export function frozenGameSgmBlocks(
  slate: SlateGame[],
  frozen: FrozenGamesSgms,
  preset: { label: string; min: number; max: number },
  picksById: Map<string, PickLeg>
): { game: SlateGame; card: GameSgmCard | null; notBuiltReason?: string }[] {
  return slate.map((game) => {
    const bet = frozen.bets.find((b) => b.gameId === game.id && b.filter === preset.label);
    const legs = bet?.legs.map((id) => picksById.get(id)).filter((l): l is PickLeg => l != null);
    if (!bet || !legs || legs.length !== bet.legs.length) {
      const reason = frozen.notBuilt.find(
        (n) => n.gameId === game.id && n.filter === preset.label
      )?.reason;
      return { game, card: null, ...(reason ? { notBuiltReason: reason } : {}) };
    }
    return {
      game,
      card: {
        game,
        legs,
        fair: bet.fair,
        takeAt: bet.takeAt,
        bestBookie: bet.bookie,
        bestTotal: bet.total,
        oddsMin: preset.min,
        oddsMax: preset.max,
      },
    };
  });
}

/** Settled Games SGM row (tracked apart from the official card record). */
export interface GamesSgmBetRow {
  slateDate: string;
  gameId: string;
  game: string;
  filter: string;
  bookie: string;
  legIds: string[];
  result: CardBetResult;
  profitUnits: number | null;
  stakeUnits: number;
  publishedCombinedPrice: number;
  /** Price after void legs are divided out (only when a leg was void). */
  settledPrice?: number;
}

export function settleGamesSgms(
  slateDate: string,
  frozen: FrozenGamesSgms | undefined,
  legResults: Map<string, CardLegResult>
): GamesSgmBetRow[] {
  const snaps = frozen?.legSnapshots ?? {};
  return (frozen?.bets ?? []).map((b) => {
    const result = settleMultiLegs(b.legs.map((id) => legResults.get(id) ?? "pending"));
    const price = voidAdjustedPrice(b.total, b.legs, legResults, (id) =>
      snaps[id] ? legPriceAtBookie(pickLegFromSnapshot(snaps[id]), b.bookie) : undefined
    );
    return {
      slateDate,
      gameId: b.gameId,
      game: b.game,
      filter: b.filter,
      bookie: b.bookie,
      legIds: b.legs,
      result,
      profitUnits: profitUnitsForBet(result, b.stakeUnits, price),
      stakeUnits: result === "pending" ? 0 : b.stakeUnits,
      publishedCombinedPrice: b.total,
      ...(price != null && price !== b.total ? { settledPrice: price } : {}),
    };
  });
}
