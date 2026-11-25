import type { InjuryEntry, InjuryStatus } from "./types.js";
import { injuriesByPlayerId } from "./player-eligibility.js";

/** Live injuries for UI badges: newest row per player by `updatedAt` (never lock-time snapshot lists). */
export function injuriesForBadges(live: InjuryEntry[]): InjuryEntry[] {
  return [...injuriesByPlayerId(live).values()];
}

/**
 * Prefer live injury feed; optional locked rows only fill players missing from live.
 * Newer `updatedAt` always wins — official-card `injuries` must not override live NBA/ESPN rows.
 */
export function mergeInjuriesNewestFirst(
  live: InjuryEntry[],
  locked?: InjuryEntry[] | null
): InjuryEntry[] {
  const map = injuriesByPlayerId(locked ?? []);
  for (const entry of live) {
    const prev = map.get(entry.playerId);
    if (!prev || new Date(entry.updatedAt) >= new Date(prev.updatedAt)) {
      map.set(entry.playerId, entry);
    }
  }
  return [...map.values()];
}

export function injuryStatusForPlayer(
  injuries: InjuryEntry[],
  playerId: string
): InjuryStatus | undefined {
  return injuriesByPlayerId(injuries).get(playerId)?.status;
}