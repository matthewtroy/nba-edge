import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { buildLegReasons } from "../lib/leg-reason-builder";
import {
  avgTextIsSupportive,
  formTextIsSupportive,
  isSupportiveReason,
} from "../lib/leg-reason-supportive";
import { legHasSupportiveReason } from "../lib/picks-supportive-filter";
import { ensureLegReasonMinimum, avgReasonFromLeg } from "../lib/leg-reason-minimum";
import { LEG_PROGRESS_TRACK_CLASS } from "../lib/leg-progress-layout";
import { reasonTextHasBannedPhrase } from "../lib/reason-ban";
import { formatInjuryReasonLine } from "../lib/injury-reason";
import { applyInjuryRedistribution } from "../lib/injury-redistribution";
import type { PickLeg, PlayerGameLog, PlayerProfile } from "../lib/types";
import { filterPicksWithSupportiveReasons } from "../lib/picks-supportive-filter";

const baseLeg = {
  id: "1",
  gameId: "g",
  team: "Indiana Pacers",
  opponent: "Philadelphia 76ers",
  playerId: "p",
  playerName: "Myles Turner",
  headshotUrl: "",
  market: "reb" as const,
  line: 5,
  probability: 0.55,
  fairPrice: 1.8,
  takeAt: 1.95,
  tags: [],
  reasons: [],
  starterEligible: true,
} as PickLeg;

describe("pass 8 item 1 — supportive reasons", () => {
  it("form needs 7/10 when p≥25%", () => {
    expect(formTextIsSupportive("6/10 at this line", 0.5)).toBe(false);
    expect(formTextIsSupportive("7/10 at this line", 0.5)).toBe(true);
  });

  it("long-shot allows 5/10 form", () => {
    expect(formTextIsSupportive("5/10 at this line", 0.2)).toBe(true);
  });

  it("rank alone is not supportive at fair odds", () => {
    const leg = { ...baseLeg, probability: 0.55 };
    expect(
      isSupportiveReason({ type: "rank", text: "Averages 10.0 reb, 3rd of 20 centers" }, leg)
    ).toBe(false);
  });

  it("drops filler-only legs from pool", () => {
    const leg: PickLeg = {
      ...baseLeg,
      recentTenVsLine: Array(10).fill("miss") as PickLeg["recentTenVsLine"],
      lastTenStatValues: Array(10).fill(2),
      reasons: [
        { type: "form", text: "2/10 at this line" },
        { type: "avg", text: "Avg 4.0 reb last 10 (season 5.0)" },
      ],
    };
    expect(legHasSupportiveReason(leg)).toBe(false);
    expect(filterPicksWithSupportiveReasons([leg])).toEqual([]);
  });

  it("display pads to at most 3 supportive lines", () => {
    const leg: PickLeg = {
      ...baseLeg,
      recentTenVsLine: Array(10).fill("hit") as PickLeg["recentTenVsLine"],
      lastTenStatValues: Array(10).fill(8),
      reasons: [{ type: "matchup", text: "Heat rank #3 in allowing reb to centers (avg. 12.0)" }],
    };
    const lines = ensureLegReasonMinimum(leg, leg.reasons);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines.length).toBeLessThanOrEqual(3);
  });

  it("avg backfill never says last 10 with fewer games", () => {
    const leg: PickLeg = {
      ...baseLeg,
      lastTenStatValues: [6, 7, 8, 9, 7, 8],
    };
    const avg = avgReasonFromLeg(leg);
    expect(avg).toMatch(/last 6/);
    expect(avg).not.toMatch(/last 10/);
    expect(avgTextIsSupportive(avg!, leg)).toBe(true);
  });

  it("matchup is supportive", () => {
    expect(
      legHasSupportiveReason({
        ...baseLeg,
        reasons: [{ type: "matchup", text: "Heat rank #2 in allowing reb to centers (avg. 11.0)" }],
      })
    ).toBe(true);
  });
});

describe("pass 8 item 2 — opponent injury + team context", () => {
  it("bans vague opponent missing copy", () => {
    expect(reasonTextHasBannedPhrase("Opponent missing 2 big(s): +1.2 reb")).toBe("opponent missing");
  });

  it("formats named opponent injury line", () => {
    const line = formatInjuryReasonLine("Pacers without Turner (C) → +1.2 reb");
    expect(line).toBe("Pacers without Turner (C) → +1.2 reb");
  });

  it("Young-style teammate pts line stays", () => {
    const line = formatInjuryReasonLine("Trae Young out: +2.4 pts");
    expect(line).toBe("Young out → +2.4 pts");
  });

  it("builder adds opponent back-to-back from schedule", () => {
    const reasons = buildLegReasons({
      leg: { ...baseLeg, market: "pts", line: 15, b2b: true },
      logs: [] as PlayerGameLog[],
      teamName: "Indiana Pacers",
      opponentName: "Philadelphia 76ers",
      opponentOnB2B: true,
    });
    expect(reasons.some((r) => /76ers on a back-to-back/i.test(r.text))).toBe(true);
    expect(reasons.some((r) => /Pacers on a back-to-back/i.test(r.text))).toBe(false);
  });

  it("opponent out big yields named reb reason", () => {
    const players: PlayerProfile[] = [
      {
        id: "b1",
        name: "Myles Turner",
        teamId: "11",
        teamName: "Indiana Pacers",
        position: "C",
        age: 28,
        headshotUrl: "",
        seasonAvgMinutes: 28,
        gameLogs: [],
      },
      {
        id: "b2",
        name: "Jarace Walker",
        teamId: "11",
        teamName: "Indiana Pacers",
        position: "PF",
        age: 21,
        headshotUrl: "",
        seasonAvgMinutes: 22,
        gameLogs: [],
      },
    ];
    const { reasons } = applyInjuryRedistribution(
      {
        players,
        injuries: [],
        gameLogsByPlayer: new Map(),
        opponentPlayers: [
          {
            id: "o1",
            name: "Joel Embiid",
            teamId: "20",
            teamName: "Philadelphia 76ers",
            position: "C",
            age: 30,
            headshotUrl: "",
            seasonAvgMinutes: 30,
            gameLogs: [],
          },
        ],
        opponentInjuries: [
          {
            playerId: "o1",
            playerName: "Joel Embiid",
            teamId: "20",
            teamName: "Philadelphia 76ers",
            gameId: "g",
            status: "Out",
            source: "test",
            updatedAt: "x",
          },
        ],
        opponentTeamName: "Philadelphia 76ers",
      },
      new Map([
        ["b1", { pts: 12, reb: 8, ast: 2, threes: 1, minutes: 28 }],
        ["b2", { pts: 10, reb: 6, ast: 2, threes: 0.5, minutes: 22 }],
      ]),
      new Map()
    );
    const rebReason = reasons.get("b1")?.find((t) => /without Embiid/i.test(t));
    expect(rebReason).toMatch(/76ers without Embiid \(C\) → \+[\d.]+ reb/);
  });
});

describe("pass 8 item 3 — progress bars", () => {
  it("uses 160px track on all rows", () => {
    expect(LEG_PROGRESS_TRACK_CLASS).toContain("w-[160px]");
    const bar = fs.readFileSync(
      path.join(process.cwd(), "src/components/LegProgress.tsx"),
      "utf8"
    );
    expect(bar).toContain("LEG_PROGRESS_TRACK_CLASS");
  });
});