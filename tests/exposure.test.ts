import { describe, it, expect } from "vitest";
import { exposureViolation } from "../lib/exposure";
import type { PickLeg, MultiBet } from "../lib/types";

function pick(id: string, playerId: string, p = 0.65): PickLeg {
  return {
    id,
    gameId: "g",
    team: "T",
    opponent: "O",
    playerId,
    playerName: playerId,
    headshotUrl: "",
    market: "pts",
    line: 20,
    probability: p,
    fairPrice: 1.5,
    takeAt: 1.62,
    tags: [],
    reasons: [],
  };
}

describe("exposure cap", () => {
  it("flags third multi for same player under 0.80", () => {
    const multis: MultiBet[] = [
      { type: "mainPlay", label: "M", legs: ["a"], combinedProbability: 0.1, combinedFairPrice: 8, combinedTakeAt: 9, oneInX: 10, summary: "" },
      { type: "booster", label: "B", legs: ["b"], combinedProbability: 0.1, combinedFairPrice: 8, combinedTakeAt: 9, oneInX: 10, summary: "" },
      { type: "longshot", label: "L", legs: ["c"], combinedProbability: 0.01, combinedFairPrice: 50, combinedTakeAt: 55, oneInX: 100, summary: "" },
    ];
    const map = new Map([
      ["a", pick("a", "player1")],
      ["b", pick("b", "player1")],
      ["c", pick("c", "player1")],
    ]);
    expect(exposureViolation(multis, map).ok).toBe(false);
  });
});