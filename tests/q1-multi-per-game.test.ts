import { describe, expect, it } from "vitest";
import { buildMultis } from "../lib/multis";
import type { PickLeg } from "../lib/types";

function q1Leg(
  id: string,
  gameId: string,
  team: string,
  market: "pts" | "reb" | "ast",
  fair: number,
  modelP = 0.8
): PickLeg {
  return {
    id,
    playerId: id,
    playerName: id,
    gameId,
    team,
    market: `q1${market}`,
    line: 5,
    probability: Math.max(modelP, 1 / fair),
    modelProbability: modelP,
    fairPrice: fair,
    takeAt: fair * 1.08,
    q1Last10HitRate: modelP,
    reasons: [],
    tags: [],
    starterEligible: true,
    projectedMinutes: 30,
    questionable: false,
    ageB2B: false,
    bookiePrices: { Sportsbet: fair },
    bestBookie: "Sportsbet",
    bestPrice: fair,
    headshotUrl: "",
    opponent: "Opp",
  };
}

describe("Q1 Multi 1/game", () => {
  it("keeps best blend-ranked leg per game, not per team", () => {
    const picks: PickLeg[] = [
      q1Leg("home-weak", "g1", "Home", "pts", 1.35, 0.55),
      q1Leg("away-strong", "g1", "Away", "pts", 1.35, 0.92),
      q1Leg("g2", "g2", "B", "pts", 1.35),
      q1Leg("g3", "g3", "C", "pts", 1.35),
    ];
    const { bets } = buildMultis(picks, 3);
    const q1 = bets.find((b) => b.type === "q1Multi");
    expect(q1).toBeDefined();
    expect(q1!.legs).toContain("away-strong");
    expect(q1!.legs).not.toContain("home-weak");
    expect(new Set(q1!.legs.map((id) => picks.find((p) => p.id === id)!.gameId)).size).toBe(
      q1!.legs.length
    );
  });

  it("notBuilt when fewer than 3 qualifying games", () => {
    const picks: PickLeg[] = [
      q1Leg("g1a", "g1", "Home", "pts", 1.35),
      q1Leg("g1b", "g1", "Away", "reb", 1.35),
      q1Leg("g2", "g2", "B", "pts", 1.35),
    ];
    const { bets, notBuilt } = buildMultis(picks, 3);
    expect(bets.some((b) => b.type === "q1Multi")).toBe(false);
    const row = notBuilt.find((n) => n.type === "q1Multi");
    expect(row?.reason).toMatch(/Only 2 games/);
    expect(row?.reason).toMatch(/1\/game|3–6/);
  });

  it("builds Q1 multi without clash filter (top 3–6 games)", () => {
    const picks: PickLeg[] = [
      q1Leg("a1", "g1", "AAA", "pts", 1.35),
      q1Leg("b1", "g2", "BBB", "pts", 1.35),
      q1Leg("c1", "g3", "CCC", "pts", 1.35),
      q1Leg("d1", "g4", "DDD", "pts", 1.35),
    ];
    const { bets } = buildMultis(picks, 3);
    const q1 = bets.find((b) => b.type === "q1Multi");
    expect(q1).toBeDefined();
    expect(q1!.legs.length).toBeGreaterThanOrEqual(3);
    expect(q1!.legs.length).toBeLessThanOrEqual(6);
  });
});