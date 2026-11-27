import { officialStakeUnits } from "./pricing-config.js";
import type { MultiBet, PickLeg, SlateGame } from "./types.js";
import type { GameSgmCard } from "./game-sgm-builder.js";
import { slateMatchupAbbrev, slateMatchupWithTip } from "./team-abbrev.js";
import {
  bestEdgeMultiQuote,
  bookieTotalsForLegs,
} from "./best-multi-bookie.js";
import { qualifiesGamesTabSgmLeg } from "./games-tab-sgm.js";
import { GAMES_TAB_SGM_RULES } from "./games-tab-sgm.js";
import { DEFAULT_MIN_EDGE } from "./multi-combined.js";

export function gameShortLabel(game: SlateGame): string {
  return slateMatchupAbbrev(game);
}

/** Games list row: "CLE @ NYK · 11:30am" */
export function gameListRowLabel(game: SlateGame): string {
  return slateMatchupWithTip(game);
}

export function gameSgmAsMulti(
  card: GameSgmCard,
  game: SlateGame,
  catalog?: PickLeg[]
): MultiBet {
  const pool = catalog ?? card.legs;
  const p = card.legs.reduce((acc, l) => acc * l.probability, 1);
  const resolved = bestEdgeMultiQuote(card.legs, {
    buildBookie: card.bestBookie,
    catalog: pool,
    legQualifies: (leg, bookie) =>
      qualifiesGamesTabSgmLeg(
        leg,
        bookie,
        DEFAULT_MIN_EDGE,
        pool,
        card.roughie ? { ...GAMES_TAB_SGM_RULES, roughie: true } : GAMES_TAB_SGM_RULES
      ),
  });
  const bestBookie = resolved?.bookie ?? card.bestBookie;
  const bestTotal = resolved?.total ?? card.bestTotal;
  const bookieTotals = catalog ? bookieTotalsForLegs(card.legs) : { [bestBookie]: bestTotal };
  return {
    type: "boostSgm",
    label: `${gameShortLabel(game)} SGM`,
    legs: card.legs.map((l) => l.id),
    combinedProbability: p,
    combinedFairPrice: card.fair,
    combinedTakeAt: card.takeAt,
    bestBookie,
    bestBookieTotal: bestTotal,
    bookieTotals,
    stakeUnits: officialStakeUnits("gamesSgm", bestTotal),
    summary: `Game SGM · bookie total $${card.oddsMin}–${card.oddsMax}`,
  };
}

export function gameSgmLockedBookie(card: GameSgmCard): string {
  return card.bestBookie;
}

export function gameSgmLegs(card: GameSgmCard): PickLeg[] {
  return card.legs;
}