import { describe, expect, it } from "vitest";
import type { PickLeg } from "../lib/types";
import {
  pickBestSameGameSgmCombo,
  SGM_MAX_LEGS,
  SGM_MIN_LEGS,
  SGM_NO_ODDS_MIN,
  SGM_NO_ODDS_MAX,
} from "../lib/same-game-sgm-search";
import { gateMulti } from "../lib/multi-gate";
import { combinedFairAndTakeAt } from "../lib/multi-combined";
import { actualEdgeFraction, requiredEdge } from "../lib/pricing-config";

function leg(
  id: string,
  price: number,
  opts: { market?: PickLeg["market"]; line?: number; probability?: number } = {}
): PickLeg {
  const probability = opts.probability ?? 0.7;
  const fairPrice = Math.round((1 / probability) * 100) / 100;
  return {
    id,
    gameId: "g1",
    team: "T",
    opponent: "O",
    playerId: id,
    playerName: id,
    headshotUrl: "",
    market: opts.market ?? "pts",
    line: opts.line ?? 20,
    probability,
    fairPrice,
    takeAt: Math.round(fairPrice * 1.08 * 100) / 100,
    tags: ["High probability"],
    reasons: [],
    starterEligible: true,
    projectedMinutes: 30,
    reasonLine: "7/10 hits at line",
    bookiePrices: { Sportsbet: price },
    bestBookie: "Sportsbet",
    bestPrice: price,
  };
}

describe("Best SGM min $2 + edge curve", () => {
  it("config: 2–5 legs, floor $2, open max", () => {
    expect(SGM_MIN_LEGS).toBe(2);
    expect(SGM_MAX_LEGS).toBe(5);
    expect(SGM_NO_ODDS_MIN).toBe(2);
    expect(SGM_NO_ODDS_MAX).toBe(Number.POSITIVE_INFINITY);
  });

  it("accepts ~$4 combined in band with curve", () => {
    // 2 legs × ~2.0 = $4
    const pool = [
      leg("a", 2.0, { market: "pts", line: 20, probability: 0.55 }),
      leg("b", 2.0, { market: "reb", line: 7, probability: 0.55 }),
    ];
    const combo = pickBestSameGameSgmCombo(pool, "Sportsbet", pool);
    expect(combo).not.toBeNull();
    expect(combo!.total).toBeCloseTo(4, 1);
    expect(combo!.total).toBeGreaterThanOrEqual(2);
    const fair = 1 / combo!.p;
    expect(actualEdgeFraction(combo!.total, fair) + 1e-9).toBeGreaterThanOrEqual(
      requiredEdge(combo!.total)
    );
  });

  it("accepts ~$25 combined (no upper limit) when curve met", () => {
    // 2.92^3 ≈ 24.9; p=0.45 → fair≈11.0; actual≈127% ≥ req≈99% at $25
    const only = [
      leg("x", 2.92, { market: "pts", line: 20, probability: 0.45 }),
      leg("y", 2.92, { market: "reb", line: 7, probability: 0.45 }),
      leg("z", 2.92, { market: "ast", line: 5, probability: 0.45 }),
    ];
    const highOnly = pickBestSameGameSgmCombo(only, "Sportsbet", only, 20, SGM_NO_ODDS_MAX);
    expect(highOnly).not.toBeNull();
    expect(highOnly!.total).toBeGreaterThan(20);
    expect(highOnly!.total).toBeLessThan(30);
    const fair = 1 / highOnly!.p;
    expect(actualEdgeFraction(highOnly!.total, fair) + 1e-9).toBeGreaterThanOrEqual(
      requiredEdge(highOnly!.total)
    );
  });

  it("rejects combined total under $2", () => {
    const pool = [
      leg("a", 1.3, { market: "pts", line: 10, probability: 0.8 }),
      leg("b", 1.3, { market: "reb", line: 5, probability: 0.8 }),
    ];
    // 1.3*1.3 = 1.69 < $2
    const combo = pickBestSameGameSgmCombo(pool, "Sportsbet", pool);
    expect(combo).toBeNull();
  });

  it("gateMulti enforces Best SGM min $2 and 2–5 legs", () => {
    const legs = [leg("a", 1.2), leg("b", 1.2)];
    const { violations } = gateMulti(
      {
        type: "boostSgm",
        label: "Best SGM",
        legs: legs.map((l) => l.id),
        combinedProbability: 0.5,
        combinedFairPrice: 2,
        combinedTakeAt: combinedFairAndTakeAt(legs, 0.08).takeAt,
        bestBookie: "Sportsbet",
        bestBookieTotal: 1.44,
        summary: "",
      },
      legs
    );
    expect(violations.some((v) => /below \$2/i.test(v))).toBe(true);
  });
});
