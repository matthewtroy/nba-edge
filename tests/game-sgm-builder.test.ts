import { describe, expect, it } from "vitest";
import {
  MIN_GAME_SGM_LEG_PRICE,
  pickGameSgmLegsWithReason,
  pickGameSgmLegs,
} from "../lib/game-sgm-builder";
import type { PickLeg } from "../lib/types";

const gameId = "g1";

function leg(
  id: string,
  overrides: Partial<PickLeg> & { bookiePrices?: Record<string, number> } = {}
): PickLeg {
  const bookiePrices = overrides.bookiePrices ?? {
    Sportsbet: 1.9,
    TAB: 1.85,
  };
  return {
    id,
    gameId,
    playerName: id,
    playerId: id,
    market: "pts",
    line: 15,
    probability: 0.65,
    fairPrice: 1.55,
    takeAt: 1.67,
    starterEligible: true,
    tags: [],
    reasons: [],
    headshotUrl: "",
    team: "AAA",
    opponent: "BBB",
    bookiePrices,
    bestBookie: "Sportsbet",
    bestPrice: bookiePrices.Sportsbet,
    ...overrides,
  } as PickLeg;
}

describe("game SGM builder", () => {
  it("enforces min leg price at bookie", () => {
    const picks = [
      leg("a", { probability: 0.7, bookiePrices: { Sportsbet: 1.48 } }),
      leg("b", { probability: 0.68, bookiePrices: { Sportsbet: 1.49 } }),
      leg("c", {
        probability: 0.66,
        team: "AAA",
        market: "pts",
        bookiePrices: { Sportsbet: 2.1 },
      }),
      leg("d", {
        probability: 0.64,
        team: "BBB",
        market: "pts",
        bookiePrices: { Sportsbet: 2.2 },
      }),
    ];
    const result = pickGameSgmLegsWithReason(picks, gameId, 3, 20);
    expect(result.legs.length).toBeGreaterThanOrEqual(2);
    for (const l of result.legs) {
      const price = l.bookiePrices?.Sportsbet ?? l.bestPrice ?? 0;
      expect(price).toBeGreaterThanOrEqual(MIN_GAME_SGM_LEG_PRICE);
    }
    expect(result.legs.map((l) => l.id).sort()).toEqual(["c", "d"]);
  });

  it("pickGameSgmLegs returns null when pool too thin", () => {
    const picks = [leg("only")];
    expect(pickGameSgmLegs(picks, gameId)).toBeNull();
  });
});