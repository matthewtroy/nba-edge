import type { Market, PlayerGameLog } from "./types.js";
import { statValue } from "./leg-history.js";
import { shortTeamName } from "./ordinal.js";
import type { H2hMeetingSummary } from "./h2h-cache.js";

/** Regular-season games vs this opponent (current + prior two seasons). */
export const H2H_SEASON_FLOOR = "2023-10-01";

function normOpp(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchesOpponent(
  g: PlayerGameLog,
  opponentTeamId: string,
  opponentName?: string
): boolean {
  if (g.opponentTeamId && g.opponentTeamId === opponentTeamId) return true;
  if (!opponentName) return false;
  const target = normOpp(opponentName);
  const opp = normOpp((g as PlayerGameLog & { opponent?: string }).opponent ?? "");
  if (!opp) return false;
  return (
    opp.includes(target) ||
    target.includes(opp) ||
    opp.split(" ").pop() === target.split(" ").pop()
  );
}

export function filterH2hLogs(
  logs: PlayerGameLog[],
  opponentTeamId: string,
  opponentName?: string
): PlayerGameLog[] {
  return logs
    .filter(
      (g) =>
        matchesOpponent(g, opponentTeamId, opponentName) &&
        g.date.slice(0, 10) >= H2H_SEASON_FLOOR &&
        g.minutes >= 1
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function summarizeH2hMeetings(
  playerId: string,
  opponentTeamId: string,
  logs: PlayerGameLog[],
  opponentName?: string
): H2hMeetingSummary | null {
  const vs = filterH2hLogs(logs, opponentTeamId, opponentName);
  if (vs.length < 3) return null;
  const n = vs.length;
  const sum = (pick: (g: PlayerGameLog) => number) =>
    vs.reduce((s, g) => s + pick(g), 0) / n;
  return {
    playerId,
    opponentTeamId,
    meetings: n,
    dates: vs.map((g) => g.date.slice(0, 10)),
    ptsAvg: sum((g) => g.pts),
    rebAvg: sum((g) => g.reb),
    astAvg: sum((g) => g.ast),
    threesAvg: sum((g) => g.threes),
    cachedAt: new Date().toISOString(),
  };
}

function statSeasonAvg(
  market: Market,
  seasonAvg?: { pts: number; reb: number; ast: number; threes: number }
): number | null {
  if (!seasonAvg) return null;
  const stat = market === "3pm" ? "threes" : market.replace(/^q1/, "");
  if (stat === "pts" || stat === "reb" || stat === "ast" || stat === "threes") {
    return seasonAvg[stat];
  }
  return null;
}

function h2hStatAvg(summary: H2hMeetingSummary, market: Market): number {
  const stat = market.replace(/^q1/, "");
  if (stat === "reb") return summary.rebAvg;
  if (stat === "ast") return summary.astAvg;
  if (stat === "3pm" || stat === "threes") return summary.threesAvg;
  return summary.ptsAvg;
}

/** Context-only copy when ≥3 meetings and standout vs line or season. */
export function h2hReasonPhrase(input: {
  logs: PlayerGameLog[];
  playerId: string;
  defendingTeamId?: string;
  market: Market;
  line: number;
  opponentName?: string;
  seasonAvg?: { pts: number; reb: number; ast: number; threes: number };
}): string | undefined {
  const { defendingTeamId } = input;
  if (!defendingTeamId) return undefined;
  const vs = filterH2hLogs(input.logs, defendingTeamId, input.opponentName);
  if (vs.length < 3) return undefined;

  const h2hAvg = vs.reduce((s, g) => s + (statValue(g, input.market) ?? 0), 0) / vs.length;
  const hits = vs.filter((g) => {
    const v = statValue(g, input.market);
    return v != null && v >= input.line;
  }).length;
  const seasonStat = statSeasonAvg(input.market, input.seasonAvg);
  const opp = shortTeamName(input.opponentName ?? defendingTeamId);
  const statWord =
    input.market === "3pm"
      ? "3pm"
      : input.market.replace(/^q1/, "");

  const standoutAtLine = h2hAvg >= input.line || hits >= Math.ceil(vs.length * 0.6);
  const standoutVsSeason =
    seasonStat != null && h2hAvg >= seasonStat * 1.12 && h2hAvg >= input.line * 0.85;
  if (!standoutAtLine && !standoutVsSeason) return undefined;

  const allHit =
    hits === vs.length &&
    vs.every((g) => {
      const v = statValue(g, input.market);
      return v != null && v >= input.line;
    });
  if (allHit && vs.length >= 3) {
    return `Hit ${input.line}+ in all ${vs.length} vs ${opp} (avg ${h2hAvg.toFixed(1)})`;
  }
  if (hits >= Math.ceil(vs.length * 0.6) && hits >= 2) {
    return `${hits} of ${vs.length} ${statWord} ${input.line}+ vs ${opp}`;
  }
  return `Meeting avg ${h2hAvg.toFixed(1)} ${statWord} vs ${opp} (${vs.length} meetings)`;
}

export { h2hStatAvg };