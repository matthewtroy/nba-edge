import type { MultiBet, PickLeg, SlateGame } from "./types.js";
import {
  buildGameSgmCard,
  formatOddsBand,
  isGameSgmCard,
  type GameSgmCard,
} from "./game-sgm-builder.js";
import { formatLegCardLine } from "./leg-card-odds.js";
import { qualifiesCrossBoostLeg } from "./main-play-eligibility.js";
import { resolveMultiFeedQuote } from "./multi-combined.js";

export interface GameSgmBlock {
  game: SlateGame;
  sgmLegs: PickLeg[];
  crossGameLegs: PickLeg[];
  boostLegs: PickLeg[];
  card: GameSgmCard | null;
  notBuiltReason?: string;
}

export function gameSgmBlocks(
  slate: SlateGame[],
  picks: PickLeg[],
  multis: MultiBet[],
  picksById: Map<string, PickLeg>,
  oddsMin = 7,
  oddsMax = 15
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
    const built = buildGameSgmCard(game, picks, oddsMin, oddsMax, undefined, picks);
    if (isGameSgmCard(built)) {
      return { game, sgmLegs, crossGameLegs, boostLegs, card: built };
    }
    return {
      game,
      sgmLegs,
      crossGameLegs,
      boostLegs,
      card: null,
      notBuiltReason: built.notBuiltReason,
    };
  });
}

function gameLabel(game: SlateGame): string {
  return `${game.awayTeam.split(" ").pop()} @ ${game.homeTeam.split(" ").pop()}`;
}

export function renderGameSgmCard(card: GameSgmCard): string {
  const label = gameLabel(card.game);
  const lines: string[] = [];
  lines.push(`${label} SGM @ $${card.bestTotal.toFixed(2)}`);
  lines.push(`${card.bestBookie} · Fair $${card.fair.toFixed(2)}`);
  lines.push(`Guide: bookie total ${formatOddsBand(card.oddsMin, card.oddsMax)}`);
  for (const leg of card.legs) {
    lines.push(formatLegCardLine(leg, card.bestBookie));
  }
  return lines.join("\n");
}

function formatBuiltMultiLine(multi: MultiBet, picksById: Map<string, PickLeg>): string {
  const legs = multi.legs.map((id) => picksById.get(id)).filter(Boolean) as PickLeg[];
  if (!legs.length || multi.bestBookieTotal == null || !multi.bestBookie) {
    return `${multi.label} · not built`;
  }
  return `${multi.label} @ $${multi.bestBookieTotal.toFixed(2)} · ${multi.bestBookie}`;
}

export function renderGamesText(input: {
  slate: SlateGame[];
  picks: PickLeg[];
  multis: MultiBet[];
  oddsMin?: number;
  oddsMax?: number;
}): string {
  const oddsMin = input.oddsMin ?? 4;
  const oddsMax = input.oddsMax ?? 10;
  const picksById = new Map(input.picks.map((p) => [p.id, p]));
  const blocks = gameSgmBlocks(
    input.slate,
    input.picks,
    input.multis,
    picksById,
    oddsMin,
    oddsMax
  );
  const lines: string[] = [
    "Games",
    `${input.slate.length} on slate · bookie total ${formatOddsBand(oddsMin, oddsMax)}`,
    "",
  ];

  const cross = input.multis.find((m) => m.type === "crossGameSgm");
  const boost = input.multis.find((m) => m.type === "boostSgm");
  lines.push(cross ? formatBuiltMultiLine(cross, picksById) : "Cross-Game SGM · not built");
  lines.push(boost ? formatBuiltMultiLine(boost, picksById) : "Best SGM · not built");
  lines.push("");

  for (const block of blocks) {
    if (block.card) {
      lines.push(renderGameSgmCard(block.card));
    } else {
      const reason =
        block.notBuiltReason ??
        `No game SGM in ${formatOddsBand(oddsMin, oddsMax)}`;
      lines.push(`${gameLabel(block.game)} · ${reason}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}