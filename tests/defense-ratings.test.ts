import { describe, expect, it } from "vitest";
import {
  buildDefenseRatings,
  defenseRankFor,
  teamLast15GameIds,
} from "../lib/defense-ratings";
import type { GameLogCacheFile } from "../lib/game-log-cache";
import { matchupDeltaFromRank } from "../lib/matchup-adjust";

function mkLog(opts: {
  gameId: string;
  date: string;
  teamId: string;
  opponentTeamId: string;
  reb?: number;
  minutes?: number;
}) {
  return {
    gameId: opts.gameId,
    date: opts.date,
    teamId: opts.teamId,
    opponentTeamId: opts.opponentTeamId,
    minutes: opts.minutes ?? 30,
    pts: 10,
    reb: opts.reb ?? 5,
    ast: 2,
    threes: 1,
  };
}

describe("defense ratings L15 by team game", () => {
  it("ranks soft defence (most allowed) as rank 1 with positive matchup delta", () => {
    const cache: GameLogCacheFile = {
      f1: {
        fetchedAt: "2026-01-01",
        headshot: "",
        logs: [],
      },
    };
    const playerMeta = new Map([["f1", { teamId: "16", position: "F" }]]);
    for (let i = 0; i < 20; i++) {
      const date = `2026-11-${String(20 - Math.min(i, 19)).padStart(2, "0")}`;
      cache.f1.logs.push(
        mkLog({
          gameId: `g${i}`,
          date,
          teamId: "16",
          opponentTeamId: i < 10 ? "22" : "5",
          reb: i < 10 ? 12 : 4,
        })
      );
    }
    const teamL15 = teamLast15GameIds(cache);
    expect(teamL15.get("22")?.size).toBeLessThanOrEqual(15);

    const bundle = buildDefenseRatings(cache, playerMeta);
    const rows = bundle.defense.filter(
      (r) => r.stat === "reb" && r.positionBucket === "F" && r.window === "last15"
    );
    const softRow = rows.find((r) => r.teamId === "22");
    const toughRow = rows.find((r) => r.teamId === "5");
    expect(softRow?.rank).toBe(1);
    expect((softRow?.allowedPer48 ?? 0)).toBeGreaterThan(toughRow?.allowedPer48 ?? 0);
    expect(matchupDeltaFromRank(1)).toBeGreaterThan(0);
    expect(matchupDeltaFromRank(28)).toBeLessThan(0);
  });
});