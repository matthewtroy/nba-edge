import type { PlayerGameLog } from "./types.js";
import { projectedMinutes } from "./baseline.js";

export function gamesPlayedInLast10(logs: PlayerGameLog[]): number {
  return logs.filter((g) => g.minutes >= 1).slice(0, 10).length;
}

/** Rotation player: not G-League/two-way style fringe (<12 min, &lt;3 games in last 10). */
export function isMeaningfulRotation(logs: PlayerGameLog[]): boolean {
  const recent = logs.filter((g) => g.minutes >= 1).slice(0, 10);
  if (recent.length < 3) return false;
  const avgMin =
    recent.reduce((s, g) => s + g.minutes, 0) / Math.max(1, recent.length);
  if (avgMin < 12) return false;
  if (projectedMinutes(logs) < 12) return false;
  return true;
}