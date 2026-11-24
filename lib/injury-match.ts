import type { InjuryEntry, InjuryStatus } from "./types.js";
import { normalizePlayerName } from "./player-names.js";

export interface RosterIndex {
  byId: Set<string>;
  idByName: Map<string, string>;
}

export function buildRosterIndex(
  rosters: { teamId: string; athletes: { id: string; name: string }[] }[]
): RosterIndex {
  const byId = new Set<string>();
  const idByName = new Map<string, string>();
  for (const team of rosters) {
    for (const a of team.athletes) {
      byId.add(a.id);
      idByName.set(normalizePlayerName(a.name), a.id);
    }
  }
  return { byId, idByName };
}

export function resolveInjuryPlayerId(
  inj: { playerId?: string; playerName: string },
  roster: RosterIndex
): string | undefined {
  if (inj.playerId && roster.byId.has(inj.playerId)) return inj.playerId;
  const norm = normalizePlayerName(inj.playerName);
  return roster.idByName.get(norm);
}

export function mergeInjuryEntry(
  entry: InjuryEntry,
  roster: RosterIndex,
  unmatchedLog: string[]
): InjuryEntry | null {
  const resolvedId = resolveInjuryPlayerId(entry, roster);
  if (!resolvedId) {
    unmatchedLog.push(`injury: unmatched ${entry.playerName} (${entry.source})`);
    return null;
  }
  return { ...entry, playerId: resolvedId };
}

export function isOutOrDoubtful(status: InjuryStatus): boolean {
  return status === "Out" || status === "Doubtful";
}