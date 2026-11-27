import { describe, expect, it } from "vitest";
import type { PickLeg } from "../lib/types";
import {
  edgeFairPrice,
  edgeFairTakeAt,
  hitFairAtLine,
} from "../lib/leg-edge-fair";
import { mainPlayHasValueOrHighProb } from "../lib/main-play-eligibility";
import { legMeetsBookieEdge } from "../lib/bookie-edge-pool";

function baseLeg(overrides: Partial<PickLeg>): PickLeg {
  return {
    id: "x",
    gameId: "g",
    team: "T",
    opponent: "O",
    playerId: "p",
    playerName: "P",
    headshotUrl: "",
    market: "reb",
    line: 5,
    probability: 0.72,
    fairPrice: 1.39,
    takeAt: 1.5,
    starter: true,
    starterEligible: true,
    tags: ["High probability"],
    reasons: [{ type: "form", text: "6/10 at this line" }],
    recentTenVsLine: ["hit", "miss", "hit", "hit", "miss", "hit", "miss", "hit", "miss", "hit"],
    bookiePrices: { Sportsbet: 1.57 },
    bestPrice: 1.57,
    bestBookie: "Sportsbet",
    ...overrides,
  };
}

describe("hitFair / edgeFair", () => {
  it("Keldon Johnson reb 5 @ 1.57 (6/10) not Main Play eligible", () => {
    const leg = baseLeg({
      playerName: "Keldon Johnson",
      fairPrice: 1.39,
      bookiePrices: { Sportsbet: 1.57, SportsBet: 1.57 },
    });
    expect(hitFairAtLine(leg)).toBeCloseTo(1 / 0.6, 2);
    expect(edgeFairPrice(leg)).toBeCloseTo(1.67, 2);
    expect(edgeFairTakeAt(leg)).toBeCloseTo(1.8, 2);
    expect(legMeetsBookieEdge(leg, "Sportsbet")).toBe(false);
    expect(mainPlayHasValueOrHighProb(leg, "Sportsbet")).toBe(false);
  });

  it("uses model fair when hit sample is stronger than model", () => {
    const leg = baseLeg({
      recentTenVsLine: Array(10).fill("hit"),
      fairPrice: 1.5,
    });
    expect(hitFairAtLine(leg)).toBe(1);
    expect(edgeFairPrice(leg)).toBe(1.5);
  });
});