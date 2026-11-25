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
    case "ptsreb":
      return log.pts + log.reb;
    case "ptsast":
      return log.pts + log.ast;
    case "rebast":
      return log.reb + log.ast;
    case "pra":
      return log.pts + log.reb + log.ast;
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

/** Last up to 5 games with Q1 stat present: fraction clearing the line. */
export function q1HitRateLast5(
  logs: PlayerGameLog[],
  market: Extract<Market, "q1pts" | "q1reb" | "q1ast">,
  line: number
): number | null {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  let hits = 0;
  let n = 0;
  for (const g of sorted.slice(0, 5)) {
    const v = statValue(g, market);
    if (v == null) continue;
    n += 1;
    if (v >= line) hits += 1;
  }
  if (n < 2) return null;
  return hits / n;
}

/** Season Q1 clears at line — "9/16" style numerator/denominator. */
export function q1SeasonHitFraction(
  logs: PlayerGameLog[],
  market: Extract<Market, "q1pts" | "q1reb" | "q1ast">,
  line: number
): { hits: number; total: number } | null {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  let hits = 0;
  let total = 0;
  for (const g of sorted) {
    const v = statValue(g, market);
    if (v == null) continue;
    total += 1;
    if (v >= line) hits += 1;
  }
  if (total < 3) return null;
  return { hits, total };
}

/** Last up to 10 full-game stat clears (✓/✗), most recent first. */
export function lastTenVsLine(
  logs: PlayerGameLog[],
  market: Market,
  line: number
): ("hit" | "miss" | "na")[] {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  return sorted.slice(0, 10).map((g) => {
    const v = statValue(g, market);
    if (v == null) return "na";
    return v >= line ? "hit" : "miss";
  });
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