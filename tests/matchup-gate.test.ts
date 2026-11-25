import { describe, expect, it } from "vitest";
import { matchupSignalsReady } from "../lib/matchup-gate";
import type { LeagueBackfillReport } from "../lib/league-season-backfill";

describe("matchup gate", () => {
  it("stays off until 95% cached and zero null opponents", () => {
    const base: LeagueBackfillReport = {
      gamesProcessed: 0,
      gamesSkippedCached: 0,
      gamesPlayedSoFar: 200,
      gamesCached: 100,
      logRowsAdded: 0,
      totalLogRows: 0,
      teamsWithLogs: 30,
      nullOpponentRows: 0,
    };
    expect(matchupSignalsReady(base)).toBe(false);
    expect(matchupSignalsReady({ ...base, gamesCached: 189 })).toBe(false);
    expect(matchupSignalsReady({ ...base, gamesCached: 190, nullOpponentRows: 1 })).toBe(false);
    expect(matchupSignalsReady({ ...base, gamesCached: 190, gamesPlayedSoFar: 200 })).toBe(true);
  });
});