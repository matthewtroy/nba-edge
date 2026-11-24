import { describe, it, expect } from "vitest";
import { legsClash } from "../lib/clash";
import type { PickLeg } from "../lib/types";

function leg(partial: Partial<PickLeg> & Pick<PickLeg, "id" | "gameId" | "team" | "playerId" | "market">): PickLeg {
  return {
    opponent: "X",
    playerName: "P",
    headshotUrl: "",
    line: 10,
    probability: 0.6,
    fairPrice: 1.67,
    takeAt: 1.8,
    tags: [],
    reasons: [],
    ...partial,
  };
}

describe("clash rules", () => {
  it("reb vs opposing pts", () => {
    const a = leg({ id: "1", gameId: "g", team: "A", playerId: "p1", market: "reb" });
    const b = leg({ id: "2", gameId: "g", team: "B", playerId: "p2", market: "pts" });
    expect(legsClash(a, b)).toBe(true);
  });

  it("two rebounds same game", () => {
    const a = leg({ id: "1", gameId: "g", team: "A", playerId: "p1", market: "reb" });
    const b = leg({ id: "2", gameId: "g", team: "B", playerId: "p2", market: "reb" });
    expect(legsClash(a, b)).toBe(true);
  });

  it("two pts same team", () => {
    const a = leg({ id: "1", gameId: "g", team: "A", playerId: "p1", market: "pts" });
    const b = leg({ id: "2", gameId: "g", team: "A", playerId: "p2", market: "pts" });
    expect(legsClash(a, b)).toBe(true);
  });

  it("q1 pts and q1 ast same player", () => {
    const a = leg({ id: "1", gameId: "g", team: "A", playerId: "p1", market: "q1pts" });
    const b = leg({ id: "2", gameId: "g", team: "A", playerId: "p1", market: "q1ast" });
    expect(legsClash(a, b)).toBe(true);
  });

  it("same player two legs", () => {
    const a = leg({ id: "1", gameId: "g", team: "A", playerId: "p1", market: "pts" });
    const b = leg({ id: "2", gameId: "g", team: "A", playerId: "p1", market: "ast" });
    expect(legsClash(a, b)).toBe(true);
  });
});