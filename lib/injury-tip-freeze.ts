import type { InjuryEntry, SlateGame } from "./types.js";
import { gameStarted } from "./slate-tip-freeze.js";
import { injuriesByPlayerId } from "./player-eligibility.js";
import { newerInjuryEntry } from "./injury-report-time.js";

/** After game tip, lock injury status for players on that game (badges + rows). */
export function freezeInjuriesAtTip(
  previous: InjuryEntry[],
  incoming: InjuryEntry[],
  slate: SlateGame[],
  now: Date
): InjuryEntry[] {
  const prevByPlayer = injuriesByPlayerId(previous);
  const startedByGame = new Map<string, boolean>();
  for (const g of slate) {
    startedByGame.set(g.id, gameStarted(g, now));
  }
  const out: InjuryEntry[] = [];
  const seen = new Set<string>();
  for (const entry of incoming) {
    const started = startedByGame.get(entry.gameId) === true;
    const prev = prevByPlayer.get(entry.playerId);
    if (started && prev) {
      out.push({
        ...entry,
        status: prev.status,
        source: prev.source,
        reportTime: prev.reportTime ?? entry.reportTime,
        updatedAt: prev.updatedAt,
      });
    } else {
      out.push(entry);
    }
    seen.add(entry.playerId);
  }
  for (const entry of previous) {
    if (seen.has(entry.playerId)) continue;
    const started = startedByGame.get(entry.gameId) === true;
    if (started) out.push(entry);
  }
  return out;
}

export function mergeInjuriesReportTime(
  rows: InjuryEntry[]
): InjuryEntry[] {
  const map = new Map<string, InjuryEntry>();
  for (const entry of rows) {
    const prev = map.get(entry.playerId);
    map.set(entry.playerId, prev ? newerInjuryEntry(entry, prev) : entry);
  }
  return [...map.values()];
}