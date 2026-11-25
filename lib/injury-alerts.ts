import type { InjuryEntry } from "./types.js";

const WATCH = new Set(["Out", "Doubtful", "Questionable"]);

function key(i: InjuryEntry): string {
  return i.playerId || `${i.teamId}:${i.playerName}`;
}

function statusRank(s: string): number {
  if (s === "Out") return 3;
  if (s === "Doubtful") return 2;
  if (s === "Questionable") return 1;
  return 0;
}

/** Injury moves since official card lock (for banner + local Swap only). */
export function injuryAlertsSinceLock(
  locked: InjuryEntry[] | undefined,
  current: InjuryEntry[]
): string[] {
  if (!locked?.length) return [];
  const byKey = new Map(locked.map((i) => [key(i), i]));
  const alerts: string[] = [];

  for (const inj of current) {
    if (!WATCH.has(inj.status)) continue;
    const prev = byKey.get(key(inj));
    if (!prev) {
      alerts.push(`${inj.playerName} now ${inj.status} (was not on official card)`);
      continue;
    }
    if (statusRank(inj.status) > statusRank(prev.status)) {
      alerts.push(`${inj.playerName} ${prev.status} → ${inj.status}`);
    }
  }
  return alerts.slice(0, 5);
}