import { describe, it, expect } from "vitest";
import {
  exposureViolation,
  enforceExposureCapWithDrops,
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

describe("exposure cap removed", () => {
  it("never flags player repetition across multis", () => {
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
    expect(exposureViolation(multis, map).ok).toBe(true);
    const { kept, dropped } = enforceExposureCapWithDrops(multis, map);
    expect(kept.length).toBe(4);
    expect(dropped.length).toBe(0);
  });
});