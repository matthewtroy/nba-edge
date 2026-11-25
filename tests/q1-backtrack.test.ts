import { describe, expect, it } from "vitest";
import { buildMultis } from "../lib/multis";
import type { PickLeg } from "../lib/types";

function q1Leg(
  id: string,
  gameId: string,
  team: string,
  market: string,
  fair: number
): PickLeg {
  return {
    id,
    playerId: id,
    playerName: id,
    gameId,
    team,
    market: `q1${market}`,
    line: 5,
    probability: 1 / fair,
    fairPrice: fair,
    takeAt: fair * 0.95,
    reasons: [],
    tags: [],
    starterEligible: true,
    questionable: false,
    ageB2B: false,
  };
}

describe("Q1 multi backtracking", () => {
  it("builds clash-free Q1 multi across teams", () => {
    const picks: PickLeg[] = [
      q1Leg("a1", "g1", "AAA", "pts", 2),
      q1Leg("a2", "g1", "AAA", "reb", 2.1),
      q1Leg("b1", "g1", "BBB", "pts", 2),
      q1Leg("c1", "g2", "CCC", "pts", 2),
      q1Leg("d1", "g2", "DDD", "pts", 2),
      q1Leg("e1", "g3", "EEE", "pts", 2),
    ];
    const { bets, notBuilt } = buildMultis(picks, 3);
    const q1 = bets.filter((b) => b.type === "q1Multi");
    expect(q1.length).toBeGreaterThanOrEqual(1);
    expect(q1[0].legs.length).toBeGreaterThanOrEqual(3);
    expect(q1.some((b) => b.variant === "Safe")).toBe(true);
  });
});