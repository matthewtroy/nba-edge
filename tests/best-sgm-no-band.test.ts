import { describe, expect, it } from "vitest";
import type { PickLeg } from "../lib/types";
import { pickBestSameGameSgmCombo, SGM_NO_ODDS_MAX } from "../lib/same-game-sgm-search";
import { gateMulti } from "../lib/multi-gate";
import { combinedFairAndTakeAt } from "../lib/multi-combined";

function leg(
  id: string,
  price: number,
  market: PickLeg["market"] = "pts",
  line = 20
): PickLeg {
  return {
    id,
    gameId: "g1",
    team: "T",
    opponent: "O",
    playerId: id,
    playerName: id,
    headshotUrl: "",
    market,
    line,
    probability: 0.65,
    fairPrice: 1.55,
    takeAt: 1.67,
    tags: ["Value"],
    reasons: [],
    starterEligible: true,
    reasonLine: "7/10 hits at line",
    bookiePrices: { Sportsbet: price },
    bestBookie: "Sportsbet",
    bestPrice: price,
  };
}

describe("Best SGM no combined band", () => {
  it("pickBestSameGameSgmCombo accepts high combined totals", () => {
    const pool = [
      leg("a", 4.2, "pts", 20),
      leg("b", 4.1, "reb", 7),
      leg("c", 4.0, "ast", 5),
    ];
    const combo = pickBestSameGameSgmCombo(pool, "Sportsbet", pool, 0, SGM_NO_ODDS_MAX);
    expect(combo).not.toBeNull();
    expect((combo?.total ?? 0) > 15).toBe(true);
  });

  it("gateMulti does not enforce Best SGM bookie band", () => {
    const legs = [leg("a", 4.5), leg("b", 4.5), leg("c", 4.5)];
    const { violations } = gateMulti(
      {
        type: "boostSgm",
        label: "Best SGM",
        legs: legs.map((l) => l.id),
        combinedProbability: 0.1,
        combinedFairPrice: 70,
        combinedTakeAt: combinedFairAndTakeAt(legs, 0.08).takeAt,
        bestBookie: "Sportsbet",
        bestBookieTotal: 91.13,
        summary: "",
      },
      legs
    );
    expect(violations.some((i) => /7–15|not \$7/i.test(i))).toBe(false);
  });
});