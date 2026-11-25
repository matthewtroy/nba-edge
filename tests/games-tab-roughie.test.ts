import { describe, expect, it } from "vitest";
import {
  ROUGHIE_LEG_MAX,
  ROUGHIE_LEG_MIN,
  ROUGHIE_MAX_LEGS,
  ROUGHIE_MIN_LEGS,
} from "../lib/pricing-config";
import {
  GAMES_TAB_SGM_RULES,
  ROUGHIE_SGM_RULES,
  qualifiesGamesTabSgmLeg,
  pickBestGamesTabSgmCombo,
} from "../lib/games-tab-sgm";
import type { PickLeg } from "../lib/types";

const leg = (id: string, price: number, p = 0.65): PickLeg =>
  ({
    id,
    gameId: "g1",
    playerId: id,
    playerName: id,
    market: "pts",
    line: 15,
    probability: p,
    fairPrice: 1 / p,
    takeAt: (1 / p) * 1.08,
    starterEligible: true,
    tags: ["High probability"],
    team: "A",
    opponent: "B",
    headshotUrl: "",
    reasons: [],
    bookiePrices: { Sportsbet: price },
    bestBookie: "Sportsbet",
    bestPrice: price,
  }) as PickLeg;

describe("Games tab Roughie rules", () => {
  it("ROUGHIE_* constants", () => {
    expect(ROUGHIE_LEG_MIN).toBe(2.5);
    expect(ROUGHIE_LEG_MAX).toBe(8);
    expect(ROUGHIE_MIN_LEGS).toBe(2);
    expect(ROUGHIE_MAX_LEGS).toBe(2);
    expect(ROUGHIE_SGM_RULES).toMatchObject({
      minLegPrice: 2.5,
      maxLegPrice: 8,
      minLegs: 2,
      maxLegs: 2,
      roughie: true,
    });
  });

  it("rejects leg above roughie max price", () => {
    const l = leg("hi", 9);
    const ok = leg("ok", 3.5);
    expect(
      qualifiesGamesTabSgmLeg(l, "Sportsbet", 0.08, [l], ROUGHIE_SGM_RULES)
    ).toBe(false);
    expect(
      qualifiesGamesTabSgmLeg(ok, "Sportsbet", 0.08, [ok], ROUGHIE_SGM_RULES)
    ).toBe(true);
  });

  it("picks at most two roughie legs in band", () => {
    const pool = [leg("a", 3.5), leg("b", 3.2), leg("c", 2.9)];
    const combo = pickBestGamesTabSgmCombo(
      pool,
      "Sportsbet",
      pool,
      10,
      20,
      ROUGHIE_SGM_RULES
    );
    expect(combo).toBeTruthy();
    expect(combo!.legs.length).toBe(2);
    expect(combo!.total).toBeGreaterThanOrEqual(10);
    expect(combo!.total).toBeLessThanOrEqual(20);
  });
});