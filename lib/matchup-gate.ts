import type { LeagueBackfillReport } from "./league-season-backfill.js";

const CACHE_FRACTION = 0.95;

export function matchupSignalsReady(report: LeagueBackfillReport): boolean {
  if (report.nullOpponentRows > 0) return false;
  if (report.gamesPlayedSoFar < 1) return false;
  return report.gamesCached >= CACHE_FRACTION * report.gamesPlayedSoFar;
}

export function matchupGateLogLine(report: LeagueBackfillReport): string {
  return `matchup signals off: backfill ${report.gamesCached}/${report.gamesPlayedSoFar}`;
}