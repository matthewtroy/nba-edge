import { describe, expect, it } from "vitest";
import { gateMulti } from "../lib/multi-gate";
import { combinedFairAndTakeAt } from "../lib/multi-combined";
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
    probability: 0.75,
    fairPrice: takeAt / 1.08,
    takeAt,
    starterEligible: true,
    starter: true,
    tags: ["High probability"],
    reasons: [{ type: "form", text: "8/10 at this line" }],
    recentTenVsLine: Array(10).fill("hit"),
    bookiePrices: { Sportsbet: takeAt },
    bestBookie: "Sportsbet",
    bestPrice: takeAt,
  };
}

describe("Booster gate", () => {
  it("allows mixed stepped and kept Main rungs", () => {
    const mainLegs = [leg("a", 20, 1.65), leg("b", 20, 1.66), leg("c", 20, 1.67)];
    const boostLegs = [leg("a", 25, 2.5), leg("b", 20, 1.66), leg("c", 25, 2.55)];
    const mainFair = combinedFairAndTakeAt(mainLegs);
    const main: MultiBet = {
      type: "mainPlay",
      label: "Main Play",
      legs: mainLegs.map((l) => l.id),
      combinedProbability: mainFair.p,
      combinedFairPrice: mainFair.fair,
      combinedTakeAt: mainFair.takeAt,
      bookieTotals: { Sportsbet: 4.58 },
      bestBookie: "Sportsbet",
      bestBookieTotal: 4.58,
      summary: "",
    };
    const boostFair = combinedFairAndTakeAt(boostLegs);
    const booster: MultiBet = {
      type: "booster",
      label: "Booster",
      legs: boostLegs.map((l) => l.id),
      combinedProbability: boostFair.p,
      combinedFairPrice: boostFair.fair,
      combinedTakeAt: boostFair.takeAt,
      bookieTotals: { Sportsbet: 10.59 },
      bestBookie: "Sportsbet",
      bestBookieTotal: 10.59,
      summary: "",
    };
    const picksById = new Map([...mainLegs, ...boostLegs].map((l) => [l.id, l]));
    const result = gateMulti(booster, boostLegs, main, picksById);
    expect(result.violations.some((v) => v.includes("stepped"))).toBe(false);
    expect(result.ok).toBe(true);
  });
});