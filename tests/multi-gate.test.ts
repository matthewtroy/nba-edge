import { describe, expect, it } from "vitest";
import { gateMulti } from "../lib/multi-gate";
import type { MultiBet, PickLeg } from "../lib/types";

const leg: PickLeg = {
  id: "a",
  gameId: "g1",
  team: "A",
  opponent: "B",
  playerId: "p1",
  playerName: "A",
  headshotUrl: "",
  market: "pts",
  line: 15,
  probability: 0.7,
  fairPrice: 1.45,
  takeAt: 1.5,
  starterEligible: true,
  tags: ["High probability"],
  reasons: [],
};

function multi(partial: Partial<MultiBet>): MultiBet {
  return {
    type: "mainPlay",
    label: "Main Play",
    legs: ["a"],
    combinedProbability: 0.7,
    combinedFairPrice: 1.45,
    combinedTakeAt: 1.5,
    oneInX: 2,
    summary: "test",
    ...partial,
  };
}

describe("multi gate", () => {
  it("rejects Best mix label", () => {
    const r = gateMulti(
      multi({
        combinedBestBookie: "Best mix",
        combinedBestPrice: 10,
        legs: ["a", "b", "c", "d"],
      }),
      [leg, leg, leg, leg]
    );
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => /Best mix/i.test(v))).toBe(true);
  });

  it("accepts valid single bookie overlay", () => {
    const priced = {
      ...leg,
      bookiePrices: { Sportsbet: 1.55 },
      takeAt: 1.5,
    };
    const m = multi({
      legs: ["a", "a2", "a3", "a4"],
      combinedTakeAt: 6.0,
      combinedBestBookie: "Sportsbet",
      combinedBestPrice: 6.1,
    });
    const legs = [
      { ...priced, id: "a" },
      { ...priced, id: "a2", playerId: "p2" },
      { ...priced, id: "a3", playerId: "p3" },
      { ...priced, id: "a4", playerId: "p4" },
    ];
    const quote = legs.map((l) => ({ ...l, takeAt: 1.55, bookiePrices: { Sportsbet: 1.56 } }));
    quote[0].probability = 0.7;
    const r = gateMulti(
      {
        ...m,
        combinedTakeAt: Math.round(quote.reduce((a, l) => a * l.takeAt, 1) * 100) / 100,
        combinedBestPrice: 5.92,
        combinedBestBookie: "Sportsbet",
      },
      quote
    );
    expect(r.violations.filter((v) => /Best mix|below take-at|mismatch/.test(v))).toEqual([]);
  });
});