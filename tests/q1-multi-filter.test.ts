import { describe, expect, it } from "vitest";
import { countQ1MultiFilters } from "../lib/q1-multi-filter-counts";
import type { PickLeg } from "../lib/types";

function q1Leg(partial: Partial<PickLeg>): PickLeg {
  return {
    id: "1",
    gameId: "g1",
    team: "A",
    opponent: "B",
    playerId: "p1",
    playerName: "P",
    headshotUrl: "",
    market: "q1reb",
    line: 2,
    probability: 0.55,
    fairPrice: 1.45,
    takeAt: 1.57,
    tags: [],
    reasons: [{ type: "form", text: "7/10 Q1 at line" }],
    starterEligible: true,
    projectedMinutes: 30,
    q1Last10HitRate: 0.5,
    modelProbability: 0.55,
    ...partial,
  };
}

describe("Q1 multi filter counts", () => {
  it("stages align with builder gates", () => {
    const legs = [
      q1Leg({ id: "ok", fairPrice: 1.35 }),
      q1Leg({
        id: "no-support",
        reasons: [{ type: "form", text: "2/10 Q1 at line" }],
      }),
      q1Leg({ id: "no-gap", q1Last10HitRate: 0.2, modelProbability: 0.55 }),
      q1Leg({ id: "bench", starterEligible: false }),
      q1Leg({ id: "low-fair", fairPrice: 1.2 }),
    ];
    const c = countQ1MultiFilters(legs, 1.3);
    expect(c.q1Market).toBe(5);
    expect(c.starter).toBe(4);
    expect(c.supportive).toBe(3);
    expect(c.hitGap).toBe(2);
    expect(c.fairMin).toBe(1);
    expect(c.onePerGame).toBe(1);
  });

  it("counts one slot per game when both teams qualify", () => {
    const legs = [
      q1Leg({ id: "home", gameId: "g1", team: "Home", fairPrice: 1.35 }),
      q1Leg({ id: "away", gameId: "g1", team: "Away", fairPrice: 1.35 }),
    ];
    const c = countQ1MultiFilters(legs, 1.3);
    expect(c.fairMin).toBe(2);
    expect(c.onePerGame).toBe(1);
  });
});