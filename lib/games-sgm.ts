import type { MultiBet, PickLeg, SlateGame } from "./types.js";
import { qualifiesCrossBoostLeg } from "./main-play-eligibility.js";
import { marketLabel } from "./market-label.js";

export interface GameSgmBlock {
  game: SlateGame;
  sgmLegs: PickLeg[];
  crossGameLegs: PickLeg[];
  boostLegs: PickLeg[];
}

export function gameSgmBlocks(
  slate: SlateGame[],
  picks: PickLeg[],
  multis: MultiBet[],
  picksById: Map<string, PickLeg>
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
    return { game, sgmLegs, crossGameLegs, boostLegs };
  });
}

export function formatSydneyTime(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function renderGamesText(input: {
  slate: SlateGame[];
  picks: PickLeg[];
  multis: MultiBet[];
}): string {
  const picksById = new Map(input.picks.map((p) => [p.id, p]));
  const blocks = gameSgmBlocks(input.slate, input.picks, input.multis, picksById);
  const lines: string[] = ["Games", `${input.slate.length} on slate`, ""];

  const cross = input.multis.find((m) => m.type === "crossGameSgm");
  const boost = input.multis.find((m) => m.type === "boostSgm");
  if (cross) {
    lines.push(`Cross-Game SGM · take-at $${cross.combinedTakeAt.toFixed(2)}+`);
  } else {
    lines.push("Cross-Game SGM · not built");
  }
  if (boost) {
    lines.push(`Boost SGM · take-at $${boost.combinedTakeAt.toFixed(2)}+ (${boost.legs.length} legs)`);
  } else {
    lines.push("Boost SGM · not built");
  }
  lines.push("");

  for (const { game, sgmLegs, crossGameLegs, boostLegs } of blocks) {
    const label = `${game.awayTeam.split(" ").pop()} @ ${game.homeTeam.split(" ").pop()}`;
    lines.push(`${label} · ${game.startTimeSydney || formatSydneyTime(game.startTime)}`);
    lines.push(`  SGM pool: ${sgmLegs.length} starter main lines`);
    for (const leg of sgmLegs.slice(0, 6)) {
      lines.push(
        `    ${leg.playerName} ${marketLabel(leg.market, leg.line)} · take-at $${leg.takeAt.toFixed(2)}+`
      );
    }
    if (sgmLegs.length > 6) lines.push(`    … +${sgmLegs.length - 6} more`);
    if (crossGameLegs.length) {
      lines.push(
        `  In Cross-Game: ${crossGameLegs.map((l) => `${l.playerName} ${marketLabel(l.market, l.line)}`).join("; ")}`
      );
    }
    if (boostLegs.length) {
      lines.push(
        `  In Boost SGM: ${boostLegs.map((l) => `${l.playerName} ${marketLabel(l.market, l.line)}`).join("; ")}`
      );
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}