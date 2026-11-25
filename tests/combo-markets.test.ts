import { describe, expect, it } from "vitest";
import { comboContainedStats, isComboPickMarket } from "../lib/combo-markets";
import { legsClash } from "../lib/clash";
import type { PickLeg } from "../lib/types";

function leg(market: PickLeg["market"], line = 20): PickLeg {
  return {
    id: `${market}-${line}`,
    gameId: "g",
    team: "T",
    opponent: "O",
    playerId: "p1",
    playerName: "Test",
    headshotUrl: "",
    market,
    line,
    probability: 0.55,
    fairPrice: 1.8,
    takeAt: 1.95,
    tags: [],
    reasons: [],
  };
}

describe("combo markets", () => {
  it("lists stat components", () => {
    expect(comboContainedStats("pra")).toEqual(["pts", "reb", "ast"]);
    expect(isComboPickMarket("ptsreb")).toBe(true);
    expect(isComboPickMarket("pts")).toBe(false);
  });

  it("clashes combo with overlapping single-stat leg", () => {
    expect(legsClash(leg("ptsreb"), leg("pts"))).toBe(true);
    expect(legsClash(leg("pts"), leg("ptsreb"))).toBe(true);
    expect(legsClash(leg("ptsreb"), leg("ast"))).toBe(false);
  });
});