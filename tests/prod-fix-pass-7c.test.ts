import { describe, expect, it } from "vitest";
import { buildLegReasons } from "../lib/leg-reason-builder";
import type { DefenseRatingsBundle, PickLeg, PlayerGameLog } from "../lib/types";
import {
  shotVolumeReason,
  threesVolumeFromLogs,
} from "../lib/player-tracking-fetch";
import type { PlayerTrackingDay } from "../lib/player-tracking-cache";

const baseLeg = {
  id: "1",
  gameId: "g",
  team: "T",
  opponent: "O",
  playerId: "p",
  playerName: "Test",
  headshotUrl: "",
  market: "pts" as const,
  line: 20,
  probability: 0.55,
  fairPrice: 1.8,
  takeAt: 1.95,
  tags: [],
  reasons: [],
  starterEligible: true,
} as PickLeg;

function logsWithAvg(avg: number, n = 10): PlayerGameLog[] {
  return Array.from({ length: n }, (_, i) => ({
    gameId: `g-${i}`,
    date: `2026-01-${String(10 - i).padStart(2, "0")}`,
    pts: avg,
    reb: 5,
    ast: 3,
    threes: 1,
    minutes: 32,
  }));
}

describe("pass 7c reason copy", () => {
  it("threesVolumeFromLogs: fg3a only, ≥5 games, 15% lift", () => {
    const logs: PlayerGameLog[] = [
      ...Array.from({ length: 5 }, (_, i) => ({
        gameId: `l5-${i}`,
        date: `2026-02-${String(10 - i).padStart(2, "0")}`,
        minutes: 30,
        pts: 15,
        reb: 4,
        ast: 2,
        threes: 2,
        fg3a: 7.1,
      })),
      ...Array.from({ length: 8 }, (_, i) => ({
        gameId: `s-${i}`,
        date: `2026-01-${String(20 - i).padStart(2, "0")}`,
        minutes: 28,
        pts: 12,
        reb: 3,
        ast: 2,
        threes: 1,
        fg3a: 4,
      })),
      { gameId: "skip", date: "2026-01-01", minutes: 20, pts: 0, reb: 0, ast: 0, threes: 0 },
    ];
    expect(threesVolumeFromLogs(logs)).toBe("More 3s: 7.1 3PA last 5 (5.2 season)");
    expect(threesVolumeFromLogs(logs.slice(0, 4))).toBeUndefined();
  });

  it("shotVolumeReason: 15% lift, More shots copy", () => {
    const tr: PlayerTrackingDay = {
      playerId: "1",
      playerName: "P",
      fgaLast5PerGame: 12,
      fgaSeasonPerGame: 7.8,
      source: "espn",
      cachedAt: "x",
    };
    expect(shotVolumeReason(tr)).toBe("More shots: 12.0 FGA last 5 (7.8 season)");
    expect(shotVolumeReason({ ...tr, fgaLast5PerGame: 8.5 })).toBeUndefined();
  });

  it("matchup: rank #N in allowing with avg", () => {
    const defense: DefenseRatingsBundle = {
      defense: [
        {
          teamId: "14",
          positionBucket: "F",
          window: "last15",
          stat: "reb",
          allowedPer48: (8 * 48) / 36,
          rank: 7,
        },
      ],
      pace: [],
      unavailable: [],
    };
    const reasons = buildLegReasons({
      leg: { ...baseLeg, market: "reb", line: 5 },
      logs: [],
      defense,
      defendingTeamId: "14",
      playerPosition: "F",
      opponentName: "Miami Heat",
    });
    const matchup = reasons.find((r) => r.type === "matchup");
    expect(matchup?.text).toBe("Heat rank #7 in allowing reb to forwards (avg. 8.0)");
  });

  it("avgPhrase uses last N when N<10", () => {
    const reasons = buildLegReasons({
      leg: baseLeg,
      logs: logsWithAvg(24, 8),
    });
    const avg = reasons.find((r) => r.type === "avg");
    expect(avg?.text).toMatch(/Avg 24\.0 pts last 8/);
    expect(avg?.text).not.toMatch(/last 10/);
  });

  it("minutesPhrase includes min", () => {
    const reasons = buildLegReasons({
      leg: baseLeg,
      logs: logsWithAvg(20).map((g, i) => ({ ...g, minutes: i < 5 ? 34 : 24 })),
    });
    const min = reasons.find((r) => r.type === "min");
    expect(min?.text).toMatch(/^Playing more: \d+ min last 5 \(\d+ season\)$/);
  });
});