import { describe, it, expect } from "vitest";
import { qualifiesStarter, isMainPlayStatLine } from "../lib/starter-eligibility";
import { qualifiesMainPlayLeg } from "../lib/multis";
import type { PickLeg } from "../lib/types";

describe("starter main lines", () => {
  it("requires 26+ min and 3/5 starts", () => {
    const logs = [
      { gameId: "a", minutes: 32, pts: 20, reb: 5, ast: 5, threes: 1, date: "2026-01-05" },
      { gameId: "b", minutes: 30, pts: 18, reb: 5, ast: 4, threes: 1, date: "2026-01-04" },
      { gameId: "c", minutes: 28, pts: 22, reb: 6, ast: 3, threes: 2, date: "2026-01-03" },
      { gameId: "d", minutes: 10, pts: 5, reb: 1, ast: 1, threes: 0, date: "2026-01-02" },
      { gameId: "e", minutes: 31, pts: 19, reb: 4, ast: 4, threes: 1, date: "2026-01-01" },
    ];
    expect(qualifiesStarter(logs, 28)).toBe(true);
    expect(qualifiesStarter(logs, 25)).toBe(false);
  });

  it("rejects 3+ reb for Main Play", () => {
    expect(isMainPlayStatLine("reb", 3)).toBe(false);
    expect(isMainPlayStatLine("reb", 5)).toBe(true);
    const leg: PickLeg = {
      id: "1",
      gameId: "g",
      team: "T",
      opponent: "O",
      playerId: "p",
      playerName: "P",
      headshotUrl: "",
      market: "reb",
      line: 3,
      probability: 0.7,
      fairPrice: 1.45,
      takeAt: 1.57,
      tags: [],
      reasons: [],
      starterEligible: true,
    };
    expect(qualifiesMainPlayLeg(leg)).toBe(false);
  });
});