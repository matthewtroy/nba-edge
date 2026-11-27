import type { InjuryEntry, InjuryStatus, PickLeg } from "./types.js";
import type { RosterIndex } from "./injury-match.js";
import { resolveInjuryPlayerId } from "./injury-match.js";
import { injuriesByPlayerId } from "./player-eligibility.js";
import { injuryEntryRecencyMs } from "./injury-report-time.js";

const TAG_STATUSES = new Set<InjuryStatus>(["Questionable", "Doubtful"]);

export function indexInjuriesForRoster(
  injuries: InjuryEntry[],
  roster: RosterIndex,
  unmatchedLog?: string[]
): Map<string, InjuryEntry> {
  const map = new Map<string, InjuryEntry>();
  for (const raw of injuries) {
    const id = resolveInjuryPlayerId(raw, roster);
    if (!id) {
      unmatchedLog?.push(
        `injury: unmatched ${raw.playerName} team ${raw.teamId ?? "?"} (${raw.source})`
      );
      continue;
    }
    const entry: InjuryEntry = { ...raw, playerId: id };
    const prev = map.get(id);
    if (!prev || injuryEntryRecencyMs(entry) >= injuryEntryRecencyMs(prev)) {
      map.set(id, entry);
    }
  }
  return map;
}

/** Q/D on the player's team → Check news + questionable on every leg. */
export function applyInjuryStatusLegTags(
  picks: PickLeg[],
  injuries: InjuryEntry[],
  roster?: RosterIndex
): void {
  const injMap = roster
    ? indexInjuriesForRoster(injuries, roster)
    : injuriesByPlayerId(injuries);
  for (const leg of picks) {
    const inj = injMap.get(leg.playerId);
    if (!inj || !TAG_STATUSES.has(inj.status)) continue;
    leg.questionable = true;
    if (!leg.tags.includes("Check news")) leg.tags.push("Check news");
  }
}