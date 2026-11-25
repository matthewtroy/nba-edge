import type { MultiBet, PickLeg, SlateGame } from "./types.js";
import type { GameSgmCard } from "./game-sgm-builder.js";

export function gameShortLabel(game: SlateGame): string {
  return `${game.awayTeam.split(" ").pop()} @ ${game.homeTeam.split(" ").pop()}`;
}

export function gameSgmAsMulti(card: GameSgmCard, game: SlateGame): MultiBet {
  const p = card.legs.reduce((acc, l) => acc * l.probability, 1);
  return {
    type: "boostSgm",
    label: `${gameShortLabel(game)} SGM`,
    legs: card.legs.map((l) => l.id),
    combinedProbability: p,
    combinedFairPrice: card.fair,
    combinedTakeAt: card.takeAt,
    bestBookie: card.bestBookie,
    bestBookieTotal: card.bestTotal,
    bookieTotals: { [card.bestBookie]: card.bestTotal },
    summary: `Game SGM · bookie total $${card.oddsMin}–${card.oddsMax}`,
  };
}

export function gameSgmLockedBookie(card: GameSgmCard): string {
  return card.bestBookie;
}

export function gameSgmLegs(card: GameSgmCard): PickLeg[] {
  return card.legs;
}