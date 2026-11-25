import { describe, expect, it } from "vitest";
import { nearestPricedRung } from "../lib/nearest-bookie-line";
import type { PickLeg } from "../lib/types";

function leg(line: number, reb: number, prices?: Record<string, number>): PickLeg {
  return {
    id: `mcd-${line}`,
    gameId: "g",
    team: "T",
    opponent: "O",
    playerId: "mcd",
    playerName: "Jaden McDaniels",
    headshotUrl: "",
    market: "reb",
    line,
    probability: reb >= line ? 0.62 : 0.4,
    fairPrice: 1.5,
    takeAt: 1.62,
    tags: [],
    reasons: [],
    bookiePrices: prices,
  };
}

describe("nearestPricedRung", () => {
  it("uses Sportsbet price on adjacent line when exact line missing", () => {
    const catalog = [
      leg(5, 6, { Sportsbet: 1.72 }),
      leg(7, 8, { Sportsbet: 2.1 }),
    ];
    const target = leg(5, 6, {});
    const q = nearestPricedRung(target, "Sportsbet", catalog);
    expect(q?.price).toBe(1.72);
  });
});