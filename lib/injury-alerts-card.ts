import type { InjuryEntry } from "./types.js";
import { injuryAlertsSinceLock } from "./injury-alerts.js";

function onCard(i: InjuryEntry, playerIds: Set<string>): boolean {
  return Boolean(i.playerId && playerIds.has(i.playerId));
}

/** Injury alerts limited to players appearing on the official card (multis legs). */
export function injuryAlertsForCard(
  officialInjuries: InjuryEntry[] | undefined,
  currentInjuries: InjuryEntry[],
  playerIds: Set<string>
): string[] {
  const current = currentInjuries.filter((i) => onCard(i, playerIds));
  const locked = officialInjuries?.filter((i) => onCard(i, playerIds));
  return injuryAlertsSinceLock(locked, current);
}