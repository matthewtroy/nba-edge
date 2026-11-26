import { describe, expect, it } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { buildLegReasons } from "../lib/leg-reason-builder";
import { houseReasonText } from "../lib/leg-reason-house";
import {
  BANNED_REASON_PHRASES,
  legReasonTextsShareDuplicateNumber,
  reasonTextHasBannedPhrase,
} from "../lib/reason-ban";
import type { DefenseRatingsBundle, PickLeg, PlayerGameLog } from "../lib/types";
import { threesVolumeFromLogs } from "../lib/player-tracking-fetch";
import { legRowReasonLines } from "../lib/leg-row-reasons";
import { gateLegReasons } from "../lib/reason-gate";

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
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    pts: avg,
    reb: 5,
    ast: 3,
    threes: 1,
    minutes: 32,
  }));
}

describe("pass 7b reason copy", () => {
  it("flags banned phrases", () => {
    for (const phrase of BANNED_REASON_PHRASES) {
      expect(reasonTextHasBannedPhrase(`x ${phrase} y`)).toBe(phrase);
    }
    expect(reasonTextHasBannedPhrase("Pace Pelicans #3 · Clippers #5")).toBe("pace rank");
  });

  it("houseReasonText passes through 70+ chars", () => {
    const long =
      "Pacers allow 18.8 pts to guards, 8th · 8/10 at this line · Avg 17.5 pts last 10";
    expect(long.length).toBeGreaterThan(70);
    expect(houseReasonText(long)).toBe(long);
  });

  it("3pm tracking uses 3PA not FGA", () => {
    const line = threesVolumeFromLogs([
      { gameId: "1", date: "2026-11-20", minutes: 30, pts: 20, reb: 5, ast: 4, threes: 3, fg3a: 8 },
      { gameId: "2", date: "2026-11-19", minutes: 32, pts: 18, reb: 4, ast: 5, threes: 2, fg3a: 7 },
      { gameId: "3", date: "2026-11-18", minutes: 34, pts: 22, reb: 6, ast: 3, threes: 4, fg3a: 9 },
      { gameId: "4", date: "2026-11-17", minutes: 31, pts: 15, reb: 3, ast: 6, threes: 1, fg3a: 5 },
      { gameId: "5", date: "2026-11-16", minutes: 33, pts: 19, reb: 4, ast: 5, threes: 3, fg3a: 8 },
      { gameId: "6", date: "2026-11-01", minutes: 30, pts: 14, reb: 4, ast: 4, threes: 2, fg3a: 5 },
    ]);
    expect(line).toMatch(/^3PA up:/);
    expect(line).not.toMatch(/FGA/i);
  });

  it("form denominator uses real game count", () => {
    const reasons = buildLegReasons({
      leg: baseLeg,
      logs: logsWithAvg(24, 8),
    });
    const form = reasons.find((r) => r.type === "form");
    expect(form?.text).toMatch(/8\/8 at this line/);
  });

  it("exact matchup rank 7 short string", () => {
    const defense: DefenseRatingsBundle = {
      defense: [
        {
          teamId: "14",
          positionBucket: "G",
          window: "last15",
          stat: "pts",
          allowedPer48: (72.7 * 48) / 36,
          rank: 7,
        },
      ],
      pace: [],
      unavailable: [],
    };
    const reasons = buildLegReasons({
      leg: { ...baseLeg, market: "pts", line: 12 },
      logs: [],
      defense,
      defendingTeamId: "14",
      playerPosition: "G",
      opponentName: "Miami Heat",
    });
    const matchup = reasons.find((r) => r.type === "matchup");
    expect(matchup?.text).toBe("Heat allow 72.7 pts to guards, 7th");
  });

  it("injury out → copy kept", () => {
    const reasons = buildLegReasons({
      leg: { ...baseLeg, market: "ast", line: 5 },
      logs: [],
      seedReasons: [{ type: "injury", text: "Jones out → +1.1 ast" }],
    });
    expect(reasons.some((r) => r.text.includes("out →"))).toBe(true);
  });

  it("q1reb legs reject full-game filler", () => {
    const leg: PickLeg = {
      ...baseLeg,
      market: "q1reb",
      line: 2,
      reasons: [
        { type: "avg", text: "Avg 4.0 reb last 10 (season 4.2)" },
        { type: "form", text: "7/10 at this line" },
      ],
      q1Last10HitRate: 0.7,
      lastTenStatValues: [1, 2, 3, 2, 1, 2, 3, 2, 1, 2],
      recentTenVsLine: ["hit", "hit", "miss", "hit", "hit"],
    };
    const out = legRowReasonLines(leg);
    expect(out.every((r) => !/^(Avg|.*reb last 10)/i.test(r.text) || /Q1/i.test(r.text))).toBe(
      true
    );
    expect(out.some((r) => /Q1/i.test(r.text))).toBe(true);
  });

  it("builder lines avoid duplicate equal numbers", () => {
    const reasons = buildLegReasons({
      leg: baseLeg,
      logs: logsWithAvg(24),
      seasonAvg: { pts: 24, reb: 5, ast: 3, threes: 1 },
    });
    const texts = reasons.map((r) => r.text);
    expect(legReasonTextsShareDuplicateNumber(texts)).toBe(false);
  });

  it("3pm leg rejects stored FGA tracking", () => {
    const gated = gateLegReasons(
      [{ type: "tracking", text: "Shot volume up: 8.0 FGA last 5 (season 6.0)" }],
      "3pm",
      3,
      2
    );
    expect(gated.some((r) => /fga/i.test(r.text))).toBe(false);
  });

  it("data branch 2026-11-28 display: no banned phrases", () => {
    const picks = JSON.parse(
      execSync("git show origin/data:public/data/2026-11-28/picks.json", {
        encoding: "utf8",
        maxBuffer: 50_000_000,
      })
    ) as PickLeg[];
    let hits = 0;
    for (const leg of picks) {
      for (const row of legRowReasonLines(leg)) {
        if (reasonTextHasBannedPhrase(row.text)) hits += 1;
      }
    }
    expect(hits).toBe(0);
  });
});