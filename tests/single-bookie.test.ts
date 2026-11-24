import { describe, expect, it } from "vitest";
import { bestSingleBookieQuote, combinedPriceForBookie } from "../lib/single-bookie";
import type { PickLeg } from "../lib/types";

function leg(prices: Record<string, number>, takeAt: number): PickLeg {
  return {
    id: "1",
    gameId: "g",
    team: "T",
    opponent: "O",
    playerId: "p",
    playerName: "P",
    headshotUrl: "",
    market: "pts",
    line: 20,
    probability: 0.6,
    fairPrice: 1.6,
    takeAt,
    bookiePrices: prices,
    tags: [],
    reasons: [],
  };
}

describe("single-bookie multis", () => {
  it("requires combined and per-leg at take-at", () => {
    const legs = [
      leg({ bet365: 1.85, Sportsbet: 1.7 }, 1.8),
      leg({ bet365: 1.9, Sportsbet: 1.95 }, 1.85),
    ];
    expect(combinedPriceForBookie(legs, "Sportsbet")).toBeCloseTo(3.32, 2);
    const quote = bestSingleBookieQuote(legs, 3.4);
    expect(quote?.bookie).toBe("bet365");
    expect(quote?.price).toBeCloseTo(3.52, 2);
    expect(bestSingleBookieQuote(legs, 3.6)).toBeUndefined();
  });
});