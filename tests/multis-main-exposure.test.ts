import { describe, expect, it } from "vitest";
import { buildMultis } from "../lib/multis";
import type { PickLeg } from "../lib/types";

function leg(
  id: string,
  playerId: string,
  playerName: string,
  gameId: string,
  overrides: Partial<PickLeg> = {}
): PickLeg {
  return {
    id,
    gameId,
    team: "T",
    opponent: "O",
    playerId,
    playerName,
    headshotUrl: "",
    market: "pts",
    line: 20,
    probability: 0.72,
    fairPrice: 1.55,
    takeAt: 1.67,
    bestPrice: 1.85,
    bestBookie: "Sportsbet",
    bookiePrices: { Sportsbet: 1.85 },
    tags: [],
    reasons: [],
    starterEligible: true,
    projectedMinutes: 32,
    ...overrides,
  };
}

describe("Main Play exposure", () => {
  it("removes Booster when Main is dropped", () => {
    const picks: PickLeg[] = [
      leg("l1", "p1", "A", "g1"),
      leg("l2", "p2", "B", "g2"),
      leg("l3", "p3", "C", "g3"),
      leg("l4", "p4", "D", "g4"),
    ];
    const { bets, notBuilt } = buildMultis(picks, 9);
    if (bets.some((b) => b.type === "mainPlay")) {
      expect(bets.some((b) => b.type === "booster")).toBe(true);
    } else {
      expect(bets.some((b) => b.type === "booster")).toBe(false);
      expect(notBuilt.some((n) => n.type === "booster")).toBe(true);
    }
  });
});