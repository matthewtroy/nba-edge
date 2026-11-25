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

/** Last up to 10 games with Q1 stat present: fraction clearing the line. */
export function q1HitRateLast10(
  logs: PlayerGameLog[],
  market: Extract<Market, "q1pts" | "q1reb" | "q1ast">,
  line: number
): number | null {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  let hits = 0;
  let n = 0;
  for (const g of sorted.slice(0, 10)) {
    const v = statValue(g, market);
    if (v == null) continue;
    n += 1;
    if (v >= line) hits += 1;
  }
  if (n < 3) return null;
  return hits / n;
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