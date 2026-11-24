import { describe, expect, it } from "vitest";
import { bookiesWithFullMulti, combinedPriceForBookie } from "../src/utils/bookie";
import type { PickLeg } from "../lib/types";

function leg(bookiePrices: Record<string, number>): PickLeg {
  return {
    id: "x",
    playerId: "p",
    playerName: "Test",
    gameId: "g",
    team: "TST",
    market: "pts",
    line: 20,
    probability: 0.5,
    fairPrice: 2,
    takeAt: 1.9,
    bestPrice: 2.1,
    bestBookie: "Sportsbet",
    bookiePrices,
    reasons: [],
    tags: [],
    starterEligible: true,
    questionable: false,
    ageB2B: false,
  };
}

describe("bookie combined multi", () => {
  it("lists bookies that price every leg", () => {
    const legs = [
      leg({ bet365: 1.9, Sportsbet: 1.95 }),
      leg({ bet365: 1.85, Sportsbet: 1.88 }),
    ];
    expect(bookiesWithFullMulti(legs)).toContain("bet365");
    expect(bookiesWithFullMulti(legs)).toContain("Sportsbet");
    expect(combinedPriceForBookie(legs, "bet365")).toBeCloseTo(3.52, 2);
  });
});