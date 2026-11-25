import { describe, expect, it } from "vitest";
import { gateMulti } from "../lib/multi-gate";
import type { MultiBet, PickLeg } from "../lib/types";

function leg(pid: string, line: number, takeAt: number): PickLeg {
  return {
    id: `${pid}-pts-${line}`,
    gameId: `g-${pid}`,
    team: "T",
    opponent: "O",
    playerId: pid,
    playerName: pid,
    headshotUrl: "",
    market: "pts",
    line,
    probability: 0.6,
    fairPrice: 1.65,
    takeAt,
    starterEligible: true,
    tags: [],
    reasons: [],
  };
}

describe("Booster gate", () => {
  it("allows mixed stepped and kept Main rungs", () => {
    const mainLegs = [leg("a", 20, 1.65), leg("b", 20, 1.66), leg("c", 20, 1.67)];
    const boostLegs = [leg("a", 25, 2.5), leg("b", 20, 1.66), leg("c", 25, 2.55)];
    const mainTakeAt =
      Math.round(mainLegs.reduce((acc, l) => acc * l.takeAt, 1) * 100) / 100;
    const main: MultiBet = {
      type: "mainPlay",
      label: "Main Play",
      legs: mainLegs.map((l) => l.id),
      combinedProbability: 0.2,
      combinedFairPrice: 5,
      combinedTakeAt: mainTakeAt,
      bookieTotals: {},
      summary: "",
    };
    const boostTakeAt =
      Math.round(boostLegs.reduce((acc, l) => acc * l.takeAt, 1) * 100) / 100;
    const booster: MultiBet = {
      type: "booster",
      label: "Booster",
      legs: boostLegs.map((l) => l.id),
      combinedProbability: 0.1,
      combinedFairPrice: 10,
      combinedTakeAt: boostTakeAt,
      bookieTotals: {},
      summary: "",
    };
    const picksById = new Map([...mainLegs, ...boostLegs].map((l) => [l.id, l]));
    const result = gateMulti(booster, boostLegs, main, picksById);
    expect(result.violations.some((v) => v.includes("stepped"))).toBe(false);
    expect(result.ok).toBe(true);
  });
});