import type { MultiBet, PickLeg, SlateGame } from "./types.js";
import { buildGameSgmCard, type GameSgmCard } from "./game-sgm-builder.js";
import { marketLabel } from "./market-label.js";
import { legOddsDisplayLine } from "./multi-combined.js";
import { qualifiesCrossBoostLeg } from "./main-play-eligibility.js";

export interface GameSgmBlock {
  game: SlateGame;
  sgmLegs: PickLeg[];
  crossGameLegs: PickLeg[];
  boostLegs: PickLeg[];
  card: GameSgmCard | null;
}

export function gameSgmBlocks(
  slate: SlateGame[],
  picks: PickLeg[],
  multis: MultiBet[],
  picksById: Map<string, PickLeg>,
  fairMin = 4,
  fairMax = 10
): GameSgmBlock[] {
  const cross = multis.find((m) => m.type === "crossGameSgm");
  const boost = multis.find((m) => m.type === "boostSgm");
  const crossIds = new Set(cross?.legs ?? []);
  const boostIds = new Set(boost?.legs ?? []);

  return slate.map((game) => {
    const sgmLegs = picks
      .filter((l) => l.gameId === game.id && qualifiesCrossBoostLeg(l))
      .sort((a, b) => b.probability - a.probability);
    const crossGameLegs = [...crossIds]
      .map((id) => picksById.get(id))
      .filter((l): l is PickLeg => l != null && l.gameId === game.id);
    const boostLegs = [...boostIds]
      .map((id) => picksById.get(id))
      .filter((l): l is PickLeg => l != null && l.gameId === game.id);
    const card = buildGameSgmCard(game, picks, fairMin, fairMax);
    return { game, sgmLegs, crossGameLegs, boostLegs, card };
  });
}

function gameLabel(game: SlateGame): string {
  return `${game.awayTeam.split(" ").pop()} @ ${game.homeTeam.split(" ").pop()}`;
}

export function renderGameSgmCard(
  card: GameSgmCard,
  cardBookie = "bet365"
): string {
  const label = gameLabel(card.game);
  const lines: string[] = [];
  if (card.bestBookie && card.bestTotal != null) {
    lines.push(`${label} SGM @ $${card.bestTotal.toFixed(2)}`);
    lines.push(
      `${card.bestBookie} · take at $${card.takeAt.toFixed(2)}+ (fair $${card.fair.toFixed(2)})`
    );
  } else {
    lines.push(`${label} SGM @ take at $${card.takeAt.toFixed(2)}+`);
    lines.push(`fair $${card.fair.toFixed(2)} · No single bookie prices every leg: check bet365`);
  }
  lines.push(`Guide: bet365 SGM · target fair $${card.fairMin.toFixed(0)}–${card.fairMax.toFixed(0)}`);
  for (const leg of card.legs) {
    lines.push(
      `  ${leg.playerName} ${marketLabel(leg.market, leg.line)} · ${legOddsDisplayLine(leg, cardBookie)}`
    );
  }
  return lines.join("\n");
}

export function renderGamesText(input: {
  slate: SlateGame[];
  picks: PickLeg[];
  multis: MultiBet[];
  fairMin?: number;
  fairMax?: number;
  cardBookie?: string;
}): string {
  const fairMin = input.fairMin ?? 4;
  const fairMax = input.fairMax ?? 10;
  const picksById = new Map(input.picks.map((p) => [p.id, p]));
  const blocks = gameSgmBlocks(
    input.slate,
    input.picks,
    input.multis,
    picksById,
    fairMin,
    fairMax
  );
  const lines: string[] = ["Games", `${input.slate.length} on slate · fair ${fairMin}–${fairMax}`, ""];

  const cross = input.multis.find((m) => m.type === "crossGameSgm");
  const boost = input.multis.find((m) => m.type === "boostSgm");
  if (cross) {
    lines.push(`Cross-Game SGM built · take-at $${cross.combinedTakeAt.toFixed(2)}+`);
  } else {
    lines.push("Cross-Game SGM · not built");
  }
  if (boost) {
    lines.push(`Boost SGM built · take-at $${boost.combinedTakeAt.toFixed(2)}+`);
  } else {
    lines.push("Boost SGM · not built");
  }
  lines.push("");

  for (const block of blocks) {
    if (block.card) {
      lines.push(renderGameSgmCard(block.card, input.cardBookie ?? "bet365"));
    } else {
      lines.push(`${gameLabel(block.game)} · no 3-leg SGM in fair ${fairMin}–${fairMax}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}
