import type { Market, PlayerGameLog } from "./types.js";

export function statValue(log: PlayerGameLog, market: Market): number | null {
  switch (market) {
    case "pts":
      return log.pts;
    case "reb":
      return log.reb;
    case "ast":
      return log.ast;
    case "3pm":
      return log.threes;
    case "q1pts":
      return log.q1Pts ?? null;
    case "q1reb":
      return log.q1Reb ?? null;
    case "q1ast":
      return log.q1Ast ?? null;
    default:
      return null;
  }
}

/** Last up to 5 games: did player clear the line? */
export function lastFiveVsLine(
  logs: PlayerGameLog[],
  market: Market,
  line: number
): ("hit" | "miss" | "na")[] {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  return sorted.slice(0, 5).map((g) => {
    const v = statValue(g, market);
    if (v == null) return "na";
    return v >= line ? "hit" : "miss";
  });
}