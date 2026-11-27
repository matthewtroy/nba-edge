import { describe, expect, it } from "vitest";
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

const picks28 = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "tests/fixtures/next-slate/2026-11-28-pre-odds.json"),
    "utf8"
  )
).picks as PickLeg[];

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
      ...Array.from({ length: 5 }, (_, i) => ({
        gameId: `l5-${i}`,
        date: `2026-11-${String(20 - i).padStart(2, "0")}`,
        minutes: 30,
        pts: 18,
        reb: 4,
        ast: 3,
        threes: 3,
        fg3a: 10,
      })),
      ...Array.from({ length: 8 }, (_, i) => ({
        gameId: `s-${i}`,
        date: `2026-10-${String(28 - i).padStart(2, "0")}`,
        minutes: 28,
        pts: 12,
        reb: 3,
        ast: 2,
        threes: 1,
        fg3a: 4,
      })),
    ]);
    expect(line).toMatch(/^More 3s:/);
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
    expect(matchup?.text).toBe("Heat rank #7 in allowing pts to guards (avg. 72.7)");
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

  it("fixture 2026-11-28 display: no banned phrases", () => {
    let hits = 0;
    for (const leg of picks28) {
      for (const row of legRowReasonLines(leg)) {
        if (reasonTextHasBannedPhrase(row.text)) hits += 1;
      }
    }
    expect(hits).toBe(0);
  });
});