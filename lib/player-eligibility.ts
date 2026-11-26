import type { InjuryEntry } from "./types.js";
import { injuryEntryRecencyMs } from "./injury-report-time.js";
import type { PlayerGameLog } from "./types.js";
import { isOutOrDoubtful } from "./injury-match.js";
import { normalizePlayerName } from "./player-names.js";

export interface EligibilityInput {
  playerId: string;
  playerName: string;
  teamId: string;
  gameLogs: PlayerGameLog[];
  injuriesByPlayer: Map<string, InjuryEntry>;
  rosterIds: Set<string>;
  returningPlayerIds: Set<string>;
}

/** Players who must not appear in any leg or multi */
export function isPlayerExcluded(input: EligibilityInput): boolean {
  const inj = input.injuriesByPlayer.get(input.playerId);
  if (inj && isOutOrDoubtful(inj.status)) return true;

  if (!input.rosterIds.has(input.playerId)) return true;

  const last3 = input.gameLogs
    .filter((g) => g.minutes >= 0)
    .slice(0, 3);
  if (
    last3.length >= 3 &&
    last3.every((g) => g.minutes <= 0) &&
    !input.returningPlayerIds.has(input.playerId)
  ) {
    return true;
  }

  return false;
}

export function injuriesByPlayerId(injuries: InjuryEntry[]): Map<string, InjuryEntry> {
  const map = new Map<string, InjuryEntry>();
  for (const i of injuries) {
    const prev = map.get(i.playerId);
    if (!prev || injuryEntryRecencyMs(i) >= injuryEntryRecencyMs(prev)) {
      map.set(i.playerId, i);
    }
  }
  return map;
}

export function detectReturningFromNotes(injuries: InjuryEntry[]): Set<string> {
  const ids = new Set<string>();
  for (const i of injuries) {
    const text = `${i.status}`.toLowerCase();
    if (text.includes("probable") || text.includes("questionable")) {
      /* not returning marker */
    }
  }
  return ids;
}

export function matchInjuryToExcludedByName(
  injuries: InjuryEntry[],
  rosterIdByName: Map<string, string>
): Map<string, InjuryEntry> {
  const map = new Map<string, InjuryEntry>();
  for (const inj of injuries) {
    let id = inj.playerId;
    if (!rosterIdByName.has(normalizePlayerName(inj.playerName))) {
      const byName = rosterIdByName.get(normalizePlayerName(inj.playerName));
      if (byName) id = byName;
    }
    if (!id) continue;
    inj.playerId = id;
    map.set(id, inj);
  }
  return map;
}