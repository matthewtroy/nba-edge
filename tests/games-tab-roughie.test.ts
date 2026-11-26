import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  ROUGHIE_LEG_MAX,
  ROUGHIE_LEG_MIN,
  ROUGHIE_MAX_LEGS,
  ROUGHIE_MAX_ROUGHIE_LEGS,
  ROUGHIE_MIN_LEGS,
  ROUGHIE_NORMAL_MAX,
  ROUGHIE_NORMAL_MIN,
} from "../lib/pricing-config";
import {
  GAMES_TAB_SGM_RULES,
  ROUGHIE_SGM_RULES,
  qualifiesGamesTabSgmLeg,
  pickBestGamesTabSgmCombo,
} from "../lib/games-tab-sgm";
import { buildGameSgmCard, isGameSgmCard } from "../lib/game-sgm-builder";
import type { PickLeg, SlateGame } from "../lib/types";
import { ensureSupportivePicks } from "./helpers/supportive-picks";

const leg = (
  id: string,
  price: number,
  p = 0.65,
  reasons: PickLeg["reasons"] = [{ type: "form", text: "7/10 at this line" }]
): PickLeg =>
  ({
    id,
    gameId: "g1",
    playerId: id,
    playerName: id,
    market: "pts",
    line: 15,
    probability: p,
    fairPrice: 1 / p,
    takeAt: (1 / p) * 0.95,
    starterEligible: true,
    tags: ["Value"],
    team: "A",
    opponent: "B",
    headshotUrl: "",
    reasons,
    bookiePrices: { Sportsbet: price },
    bestBookie: "Sportsbet",
    bestPrice: price,
  }) as PickLeg;

const heatPhiFixture = JSON.parse(
  fs.readFileSync(
    path.join(import.meta.dirname, "fixtures/games-tab-heat-phi.json"),
    "utf8"
  )
) as { games: SlateGame[]; picks: PickLeg[] };
const heatPhiPicks = ensureSupportivePicks(heatPhiFixture.picks);

describe("Games tab Roughie rules", () => {
  it("ROUGHIE_* constants", () => {
    expect(ROUGHIE_LEG_MIN).toBe(2.5);
    expect(ROUGHIE_LEG_MAX).toBe(8);
    expect(ROUGHIE_NORMAL_MIN).toBe(1.35);
    expect(ROUGHIE_NORMAL_MAX).toBe(2.5);
    expect(ROUGHIE_MIN_LEGS).toBe(2);
    expect(ROUGHIE_MAX_LEGS).toBe(5);
    expect(ROUGHIE_MAX_ROUGHIE_LEGS).toBe(2);
    expect(ROUGHIE_SGM_RULES).toMatchObject({
      minLegPrice: 1.35,
      minLegs: 2,
      maxLegs: 5,
      maxRoughieLegs: 2,
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

  it("roughie mode is value-only (no high-probability bypass)", () => {
    const valueLeg = leg("val", 3, 0.65, [{ type: "form", text: "7/10 at this line" }]);
    valueLeg.takeAt = 2.9;
    const noValue = leg("nv", 3, 0.9, [{ type: "form", text: "7/10 at this line" }]);
    noValue.takeAt = 3.2;
    expect(
      qualifiesGamesTabSgmLeg(valueLeg, "Sportsbet", 0.08, [valueLeg], ROUGHIE_SGM_RULES)
    ).toBe(true);
    expect(
      qualifiesGamesTabSgmLeg(noValue, "Sportsbet", 0.08, [noValue], ROUGHIE_SGM_RULES)
    ).toBe(false);
  });

  it("roughie mode requires real reasons", () => {
    const noReason = leg("nr", 3.5, 0.65, []);
    expect(
      qualifiesGamesTabSgmLeg(noReason, "Sportsbet", 0.08, [noReason], ROUGHIE_SGM_RULES)
    ).toBe(false);
  });

  it("picks mixed combo with at most two roughie legs", () => {
    const pool = [
      leg("r1", 3.5),
      leg("r2", 4.2),
      leg("r3", 2.9),
      leg("n1", 1.6),
      leg("n2", 1.45),
    ];
    const combo = pickBestGamesTabSgmCombo(
      pool,
      "Sportsbet",
      pool,
      10,
      20,
      ROUGHIE_SGM_RULES
    );
    expect(combo).toBeTruthy();
    const rough = combo!.legs.filter((l) => (l.bestPrice ?? 0) >= ROUGHIE_LEG_MIN);
    const normal = combo!.legs.filter((l) => (l.bestPrice ?? 0) < ROUGHIE_LEG_MIN);
    expect(rough.length).toBeGreaterThanOrEqual(1);
    expect(rough.length).toBeLessThanOrEqual(2);
    expect(normal.length).toBeGreaterThanOrEqual(1);
    expect(combo!.legs.length).toBeGreaterThanOrEqual(2);
    expect(combo!.legs.length).toBeLessThanOrEqual(5);
    expect(combo!.total).toBeGreaterThanOrEqual(10);
    expect(combo!.total).toBeLessThanOrEqual(20);
  });

  it("builds Heat @ 76ers roughie SGM from 2026-11-26 fixture ($10–20)", () => {
    const game = heatPhiFixture.games[0];
    expect(game.id).toBe("401909317");
    const built = buildGameSgmCard(
      game,
      heatPhiPicks,
      10,
      20,
      0.08,
      heatPhiPicks,
      ROUGHIE_SGM_RULES
    );
    expect(isGameSgmCard(built)).toBe(true);
    if (!isGameSgmCard(built)) return;
    expect(built.roughie).toBe(true);
    expect(built.legs.length).toBeGreaterThanOrEqual(2);
    expect(built.legs.length).toBeLessThanOrEqual(5);
    const rough = built.legs.filter((l) => (l.bestPrice ?? 0) >= ROUGHIE_LEG_MIN);
    expect(rough.length).toBeGreaterThanOrEqual(1);
    expect(rough.length).toBeLessThanOrEqual(2);
    expect(built.bestTotal).toBeGreaterThanOrEqual(10);
    expect(built.bestTotal).toBeLessThanOrEqual(20);
    for (const l of built.legs) {
      expect((l.reasons?.length ?? 0)).toBeGreaterThan(0);
    }
  });
});