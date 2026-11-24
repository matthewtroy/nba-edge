import type { PlayerGameLog } from "./types.js";
import type { Market } from "./types.js";

const START_MINUTES = 20;
const MAIN_PLAY_MINUTES = 24;

export function startsInLastFive(logs: PlayerGameLog[]): number {
  const recent = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  return recent.filter((g) => g.minutes >= START_MINUTES).length;
}

export function qualifiesStarter(
  logs: PlayerGameLog[],
  projectedMinutes: number
): boolean {
  return projectedMinutes >= MAIN_PLAY_MINUTES && startsInLastFive(logs) >= 3;
}

/** Main stat rungs for Main Play — no micro 3+ reb/ast */
export function isMainPlayStatLine(market: Market, line: number): boolean {
  if (market === "pts") return line >= 10;
  if (market === "reb") return line >= 5;
  if (market === "ast") return line >= 5;
  if (market === "3pm") return line >= 2;
  return false;
}