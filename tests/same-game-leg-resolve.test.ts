import { describe, expect, it } from "vitest";
import type { PickLeg } from "../lib/types";
import { pickSameGameLegSubsetResolved } from "../lib/same-game-leg-resolve";

function leg(id: string, pid: string, market: string, line: number, p: number): PickLeg {
  return {
    id,
    playerId: pid,
    playerName: id,
    gameId: "g1",
    team: "A",
    market: market as PickLeg["market"],
    line,
    probability: p,
    fairPrice: 2,
    takeAt: 2.1,
    bestPrice: 1.9,
    tags: [],
  } as PickLeg;
}

describe("same-game leg clash resolve", () => {
  it("keeps higher-p leg when two teammates clash on reb 10+", () => {
    const pool = [
      leg("a", "p1", "reb", 10, 0.55),
      leg("b", "p2", "reb", 10, 0.45),
      leg("c", "p3", "pts", 15, 0.5),
    ];
    const picked = pickSameGameLegSubsetResolved(pool, 2, 3);
    expect(picked).not.toBeNull();
    expect(picked!.some((l) => l.id === "b")).toBe(false);
    expect(picked!.length).toBeGreaterThanOrEqual(2);
  });

  it("returns null when fewer than 2 legs possible", () => {
    expect(pickSameGameLegSubsetResolved([leg("a", "p1", "reb", 10, 0.4)], 2, 3)).toBeNull();
  });
});