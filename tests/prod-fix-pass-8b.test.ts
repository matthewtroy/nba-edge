import { describe, expect, it } from "vitest";
import {
  formTextIsSupportive,
  isSupportiveReason,
  rankTextIsSupportive,
} from "../lib/leg-reason-supportive";
import { buildLegReasons } from "../lib/leg-reason-builder";
import { formerTeamReasonPhrase, seasonCeilingVsOpponentPhrase } from "../lib/long-shot-reason";
import type { PickLeg, PlayerGameLog } from "../lib/types";

const baseLeg = {
  id: "1",
  gameId: "g",
  team: "T",
  opponent: "O",
  playerId: "p",
  playerName: "Test",
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

describe("pass 8b item 2 — position rank supportive", () => {
  it("rank with avg ≥ line is supportive at fair odds", () => {
    const text = "Averages 10.0 reb, 3rd of 20 centers";
    expect(rankTextIsSupportive(text, { ...baseLeg, line: 8 })).toBe(true);
    expect(isSupportiveReason({ type: "rank", text }, { ...baseLeg, line: 8 })).toBe(
      true
    );
  });

  it("rank below line or outside top 15 is not supportive", () => {
    const text = "Averages 10.0 reb, 3rd of 20 centers";
    expect(rankTextIsSupportive(text, { ...baseLeg, line: 12 })).toBe(false);
    const low = "Averages 12.0 reb, 18th of 20 centers";
    expect(rankTextIsSupportive(low, { ...baseLeg, line: 5 })).toBe(false);
  });
});

describe("pass 8b item 3 — form hit-rate gates", () => {
  it("≥25% prob needs ≥60% hit rate", () => {
    expect(formTextIsSupportive("6/10 at this line", 0.5)).toBe(true);
    expect(formTextIsSupportive("5/10 at this line", 0.5)).toBe(false);
    expect(formTextIsSupportive("5/5 at this line", 0.5)).toBe(true);
  });

  it("<25% prob: rate > p and hits ≥2", () => {
    expect(formTextIsSupportive("3/10 at this line", 0.09)).toBe(true);
    expect(formTextIsSupportive("1/10 at this line", 0.09)).toBe(false);
    expect(formTextIsSupportive("2/10 at this line", 0.22)).toBe(false);
  });
});

describe("pass 8b item 4 — long-shot extras", () => {
  const vsOpp: PlayerGameLog[] = [
    {
      gameId: "1",
      date: "2026-11-05",
      minutes: 30,
      pts: 32,
      reb: 4,
      ast: 3,
      threes: 2,
      opponentTeamId: "14",
    },
    {
      gameId: "2",
      date: "2026-10-20",
      minutes: 28,
      pts: 18,
      reb: 3,
      ast: 2,
      threes: 1,
      opponentTeamId: "14",
    },
  ];

  it("ceiling phrase when season best vs opp clears line", () => {
    const line = seasonCeilingVsOpponentPhrase({
      logs: vsOpp,
      defendingTeamId: "14",
      opponentName: "Miami Heat",
      market: "pts",
      line: 25,
      slateDate: "2026-11-28",
    });
    expect(line).toBe("Best this season: 32 vs Heat");
  });

  it("former team line from badge tag", () => {
    expect(formerTeamReasonPhrase(["former_team", "Roughie"], "Boston Celtics")).toBe(
      "Former team vs Celtics"
    );
  });

  it("builder attaches long-shot extras under 25%", () => {
    const reasons = buildLegReasons({
      leg: {
        ...baseLeg,
        market: "pts",
        line: 25,
        probability: 0.12,
        tags: ["former_team"],
      },
      logs: vsOpp,
      h2hLogs: vsOpp,
      defendingTeamId: "14",
      opponentName: "Miami Heat",
      slateDate: "2026-11-28",
    });
    expect(reasons.some((r) => /^Best this season:/i.test(r.text))).toBe(true);
    expect(reasons.some((r) => /^Former team vs /i.test(r.text))).toBe(true);
    expect(
      isSupportiveReason(
        { type: "h2h", text: "Best this season: 32 vs Heat" },
        { ...baseLeg, probability: 0.12, line: 25 }
      )
    ).toBe(true);
    expect(
      isSupportiveReason(
        { type: "h2h", text: "Best this season: 32 vs Heat" },
        { ...baseLeg, probability: 0.5, line: 25 }
      )
    ).toBe(false);
  });
});
