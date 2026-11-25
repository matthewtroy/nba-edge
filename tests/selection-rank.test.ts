import { describe, it, expect } from "vitest";
import { sortLegsForSelection } from "../lib/multis";
import type { PickLeg } from "../lib/types";

function leg(id: string, p: number, inj: boolean, edge: number): PickLeg {
  return {
    id,
    gameId: "g",
    team: "T",
    opponent: "O",
    playerId: id,
    playerName: id,
    headshotUrl: "",
    market: "pts",
    line: 20,
    probability: p,
    fairPrice: 1.6,
    takeAt: 1.7,
    bestPrice: 1.7 + edge,
    tags: [],
    reasons: inj ? [{ type: "injury" as const, text: "Star out: +2 pts" }] : [],
  };
}

describe("sortLegsForSelection", () => {
  it("ranks injury before probability before edge", () => {
    const a = leg("a", 0.7, false, 0.2);
    const b = leg("b", 0.65, true, 0.1);
    const c = leg("c", 0.72, false, 0.05);
    const sorted = [a, b, c].sort(sortLegsForSelection);
    expect(sorted[0].id).toBe("b");
    expect(sorted[1].id).toBe("c");
  });
});