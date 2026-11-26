import { describe, expect, it } from "vitest";
import { buildLegReasons } from "../lib/leg-reason-builder";
import { opponentOnB2BFromGame } from "../lib/schedule-b2b";
import type { PickLeg, SlateGame } from "../lib/types";

const baseLeg = {
  id: "1",
  gameId: "g",
  team: "Indiana Pacers",
  opponent: "Philadelphia 76ers",
  playerId: "p",
  playerName: "Myles Turner",
  headshotUrl: "",
  market: "pts" as const,
  line: 15,
  probability: 0.55,
  fairPrice: 1.8,
  takeAt: 1.95,
  tags: [],
  reasons: [],
  starterEligible: true,
} as PickLeg;

const game: SlateGame = {
  id: "g",
  startTime: "x",
  startTimeSydney: "x",
  homeTeam: "Indiana Pacers",
  awayTeam: "Philadelphia 76ers",
  homeTeamId: "11",
  awayTeamId: "20",
  homeB2B: false,
  awayB2B: true,
};

describe("opponent B2B from ESPN schedule", () => {
  it("flags opponent-only B2B", () => {
    expect(opponentOnB2BFromGame(game, "Indiana Pacers")).toBe(true);
    expect(opponentOnB2BFromGame(game, "Philadelphia 76ers")).toBe(false);
  });

  it("does not flag when both teams on B2B", () => {
    const both: SlateGame = { ...game, homeB2B: true };
    expect(opponentOnB2BFromGame(both, "Indiana Pacers")).toBe(false);
    expect(opponentOnB2BFromGame(both, "Philadelphia 76ers")).toBe(false);
  });

  it("never emits back-to-back opponent reason copy", () => {
    const reasons = buildLegReasons({
      leg: { ...baseLeg, b2b: true },
      logs: [],
      teamName: "Indiana Pacers",
      opponentName: "Philadelphia 76ers",
    });
    expect(reasons.some((r) => /back-to-back/i.test(r.text))).toBe(false);
  });
});