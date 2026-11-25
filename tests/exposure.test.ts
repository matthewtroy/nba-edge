import { describe, it, expect } from "vitest";
import {
  exposureViolation,
  enforceExposureCapWithDrops,
  MAX_PLAYER_BETS_EXCLUDING_BOOSTER,
} from "../lib/exposure";
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

function multi(type: MultiBet["type"], legs: string[]): MultiBet {
  return {
    type,
    label: type,
    legs,
    combinedProbability: 0.1,
    combinedFairPrice: 8,
    combinedTakeAt: 9,
    summary: "",
  };
}

describe("exposure cap", () => {
  it(`allows booster on top of ${MAX_PLAYER_BETS_EXCLUDING_BOOSTER} other multis`, () => {
    const map = new Map([
      ["a", pick("a", "player1")],
      ["b", pick("b", "player1")],
      ["c", pick("c", "player1")],
      ["d", pick("d", "player1")],
    ]);
    const multis: MultiBet[] = [
      multi("mainPlay", ["a"]),
      multi("longshot", ["b"]),
      multi("boostSgm", ["c"]),
      multi("booster", ["d"]),
    ];
    expect(exposureViolation(multis, map).ok).toBe(true);
  });

  it("flags fourth non-booster multi for same player", () => {
    const map = new Map([
      ["a", pick("a", "player1")],
      ["b", pick("b", "player1")],
      ["c", pick("c", "player1")],
      ["d", pick("d", "player1")],
    ]);
    const multis: MultiBet[] = [
      multi("mainPlay", ["a"]),
      multi("longshot", ["b"]),
      multi("boostSgm", ["c"]),
      multi("crossGameSgm", ["d"]),
    ];
    expect(exposureViolation(multis, map).ok).toBe(false);
    const { dropped } = enforceExposureCapWithDrops(multis, map);
    expect(dropped[0].reason).toMatch(/max 3, Booster exempt/);
  });
});