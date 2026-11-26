import { describe, it, expect } from "vitest";
import { buildMultis, MIN_LEG_FAIR, qualifiesMainPlayLeg } from "../lib/multis";
import type { PickLeg } from "../lib/types";

function leg(
  id: string,
  gameId: string,
  playerId: string,
  fair: number,
  takeAt: number,
  p: number
): PickLeg {
  return {
    id,
    gameId,
    team: "T",
    opponent: "O",
    playerId,
    playerName: id,
    headshotUrl: "",
    market: "pts",
    line: 20,
    probability: p,
    fairPrice: fair,
    takeAt,
    tags: ["Value"],
    reasons: [{ type: "form", text: "7/10 at this line" }],
    starterEligible: true,
    confluence: 2,
    signals: { PRICE: { active: true }, MATCHUP: { active: true, label: "D#3" } },
    bestPrice: takeAt,
    bestBookie: "Sportsbet",
    bookiePrices: { Sportsbet: takeAt },
    reasonLine: "7/10 hits at line",
  };
}

describe("multis price floors", () => {
  it("MIN_LEG_FAIR is 1.30", () => {
    expect(MIN_LEG_FAIR).toBe(1.3);
  });

  it("main play price band uses bookie decimal when set", () => {
    const belowFair = leg("a", "g1", "p1", 1.39, 1.5, 0.72);
    expect(qualifiesMainPlayLeg(belowFair)).toBe(false);
    expect(qualifiesMainPlayLeg(belowFair, "Sportsbet")).toBe(true);
    expect(qualifiesMainPlayLeg(leg("b", "g1", "p2", 1.45, 1.57, 0.69), "Sportsbet")).toBe(
      true
    );
  });

  it("not built when main cannot form", () => {
    const picks = [leg("only", "g1", "p1", 1.5, 1.62, 0.67)];
    const { notBuilt } = buildMultis(picks, 1);
    expect(notBuilt.find((n) => n.type === "mainPlay")?.reason).toMatch(/Only/);
  });
});