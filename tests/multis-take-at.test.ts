import { describe, it, expect } from "vitest";
import { combinedBetPrice } from "../lib/multis";
import type { PickLeg } from "../lib/types";

const base: PickLeg = {
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
  takeAt: 1.73,
  tags: [],
  reasons: [],
};

describe("combinedBetPrice", () => {
  it("uses bookie only when every leg is at or above take-at", () => {
    const legs = [
      { ...base, id: "a", bestPrice: 1.8, takeAt: 1.73 },
      { ...base, id: "b", bestPrice: 1.5, takeAt: 1.73 },
    ];
    expect(combinedBetPrice(legs)).toBeCloseTo(1.73 * 1.73, 2);
    legs[1].bestPrice = 1.9;
    expect(combinedBetPrice(legs)).toBeCloseTo(1.8 * 1.9, 2);
  });
});