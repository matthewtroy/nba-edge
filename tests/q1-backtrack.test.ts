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
    probability: Math.max(0.75, 1 / fair),
    fairPrice: fair,
    takeAt: fair * 0.95,
    q1Last10HitRate: 0.75,
    modelProbability: 0.75,
    reasons: [],
    tags: [],
    starterEligible: true,
    projectedMinutes: 30,
    questionable: false,
    ageB2B: false,
    bookiePrices: { Sportsbet: fair },
    bestBookie: "Sportsbet",
    bestPrice: fair,
    headshotUrl: "",
    opponent: "Opp",
  };
}

describe("Q1 multi backtracking", () => {
  it("builds Q1 multi with one leg per game", () => {
    const picks: PickLeg[] = [
      q1Leg("a1", "g1", "AAA", "pts", 2),
      q1Leg("b1", "g2", "BBB", "pts", 2),
      q1Leg("c1", "g3", "CCC", "pts", 2),
      q1Leg("d1", "g4", "DDD", "pts", 2),
      q1Leg("e1", "g5", "EEE", "pts", 2),
    ];
    const { bets, notBuilt } = buildMultis(picks, 3);
    const q1 = bets.filter((b) => b.type === "q1Multi");
    expect(q1.length).toBeGreaterThanOrEqual(1);
    expect(q1[0].legs.length).toBeGreaterThanOrEqual(3);
    expect(q1.some((b) => !b.variant || b.label === "Q1 Multi")).toBe(true);
  });
});