import { describe, expect, it } from "vitest";
import type { PickLeg } from "../lib/types";
import { pickBestSameGameSgmCombo, SGM_NO_ODDS_MAX } from "../lib/same-game-sgm-search";
import { gateMulti } from "../lib/multi-gate";
import { combinedFairAndTakeAt } from "../lib/multi-combined";
import { actualEdgeFraction, requiredEdge } from "../lib/pricing-config";

function leg(
  id: string,
  price: number,
  market: PickLeg["market"] = "pts",
  line = 20,
  probability = 0.5
): PickLeg {
  const fairPrice = Math.round((1 / probability) * 100) / 100;
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
    probability,
    fairPrice,
    takeAt: Math.round(fairPrice * 1.08 * 100) / 100,
    tags: ["Value"],
    reasons: [],
    starterEligible: true,
    projectedMinutes: 30,
    reasonLine: "7/10 hits at line",
    bookiePrices: { Sportsbet: price },
    bestBookie: "Sportsbet",
    bestPrice: price,
  };
}

describe("Best SGM open max (curve still applies)", () => {
  it("pickBestSameGameSgmCombo accepts high combined totals when curve met", () => {
    const pool = [
      leg("a", 4.2, "pts", 20, 0.4),
      leg("b", 4.1, "reb", 7, 0.4),
      leg("c", 4.0, "ast", 5, 0.4),
    ];
    const combo = pickBestSameGameSgmCombo(pool, "Sportsbet", pool, 2, SGM_NO_ODDS_MAX);
    expect(combo).not.toBeNull();
    expect((combo?.total ?? 0) > 15).toBe(true);
    const fair = 1 / combo!.p;
    expect(actualEdgeFraction(combo!.total, fair) + 1e-9).toBeGreaterThanOrEqual(
      requiredEdge(combo!.total)
    );
  });

  it("gateMulti does not enforce old $7–$15 Best SGM band", () => {
    const legs = [
      leg("a", 4.5, "pts", 20, 0.4),
      leg("b", 4.5, "reb", 7, 0.4),
      leg("c", 4.5, "ast", 5, 0.4),
    ];
    const { violations } = gateMulti(
      {
        type: "boostSgm",
        label: "Best SGM",
        legs: legs.map((l) => l.id),
        combinedProbability: 0.064,
        combinedFairPrice: 15.625,
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
