import type { PlayerGameLog } from "./types.js";
import type { Market } from "./types.js";

const START_MINUTES = 20;
const MAIN_PLAY_MINUTES = 24;
const STARTS_IN_LAST_FIVE_MIN = 4;

function recentFive(logs: PlayerGameLog[]): PlayerGameLog[] {
  return [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
}

/** ESPN boxscore starts in the player's last five games (minutes proxy when `started` missing). */
export function startsInLastFive(logs: PlayerGameLog[]): number {
  return recentFive(logs).filter((g) =>
    g.started === true ? true : g.started === false ? false : g.minutes >= START_MINUTES
  ).length;
}

export function qualifiesStarter(
  logs: PlayerGameLog[],
  projectedMinutes: number
): boolean {
  return projectedMinutes >= MAIN_PLAY_MINUTES && startsInLastFive(logs) >= STARTS_IN_LAST_FIVE_MIN;
}

/** Main stat rungs for Main Play — no micro 3+ reb/ast */
export function isMainPlayStatLine(market: Market, line: number): boolean {
  if (market === "pts") return line >= 10;
  if (market === "reb") return line >= 5;
  if (market === "ast") return line >= 5;
  if (market === "3pm") return line >= 1;
  return false;
}