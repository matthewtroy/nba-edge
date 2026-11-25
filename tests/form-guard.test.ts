import { describe, expect, it } from "vitest";
import { formGuardReason } from "../lib/form-guard";
import type { PickLeg, PlayerGameLog } from "../lib/types";

const baseLeg: PickLeg = {
  id: "x",
  gameId: "g",
  team: "T",
  opponent: "O",
  playerId: "p",
  playerName: "Naz Reid",
  headshotUrl: "",
  market: "3pm",
  line: 5,
  probability: 0.35,
  fairPrice: 2.5,
  takeAt: 2.7,
  tags: ["Value"],
  reasons: [],
};

function logs(threes: number[]): PlayerGameLog[] {
  return threes.map((t, i) => ({
    gameId: `g${i}`,
    date: `2026-11-${20 - i}`,
    minutes: 28,
    pts: 10,
    reb: 5,
    ast: 2,
    threes: t,
    source: "espn" as const,
  }));
}

describe("form guard", () => {
  it("excludes 0/5 cold streak when p<50%", () => {
    const leg = { ...baseLeg, line: 2, probability: 0.35 };
    const reason = formGuardReason(
      leg,
      logs([0, 0, 0, 0, 0, 3, 3, 3, 3, 3] as number[])
    );
    expect(reason).toMatch(/0\/5/);
  });

  it("excludes when last-10 hit rate 20pp+ below probability", () => {
    const leg = { ...baseLeg, market: "pts" as const, line: 20, probability: 0.7 };
    const ptsLogs: PlayerGameLog[] = Array.from({ length: 10 }, (_, i) => ({
      gameId: `g${i}`,
      date: `2026-11-${20 - i}`,
      minutes: 32,
      pts: 12,
      reb: 5,
      ast: 2,
      threes: 1,
      source: "espn" as const,
    }));
    const reason = formGuardReason(leg, ptsLogs);
    expect(reason).toMatch(/last-10/);
  });
});