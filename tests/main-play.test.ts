import { describe, it, expect } from "vitest";
import { buildMultis, qualifiesMainPlayLeg, combinedBetPrice } from "../lib/multis";
import type { PickLeg } from "../lib/types";

function synthLeg(
  i: number,
  gameId: string,
  playerId: string,
  p: number,
  fair = 1.65,
  takeAt = 1.78
): PickLeg {
  return {
    id: `leg-${i}`,
    gameId,
    team: `Team${i}`,
    opponent: "Opp",
    playerId,
    playerName: `Player ${i}`,
    headshotUrl: "",
    market: "pts",
    line: 20,
    probability: p,
    fairPrice: fair,
    takeAt,
    tags: ["Value"],
    reasons: [{ type: "form", text: "7/10 at this line" }],
    starterEligible: true,
    confluence: 2,
    signals: { PRICE: { active: true }, FORM: { active: true, label: "L10 65%" } },
    bookiePrices: { Sportsbet: Math.round(fair * 1.1 * 100) / 100 },
    bestBookie: "Sportsbet",
    bestPrice: Math.round(fair * 1.1 * 100) / 100,
    reasonLine: "7/10 hits at line",
  };
}

describe("main play builder", () => {
  it("qualifies at fair 1.40 without tags", () => {
    const leg = synthLeg(1, "g1", "p1", 0.71, 1.41, 1.52);
    expect(qualifiesMainPlayLeg(leg)).toBe(true);
  });

  it("combined take-at between 5 and 20 when buildable", () => {
    const picks: PickLeg[] = [
      synthLeg(1, "g1", "p1", 0.65, 1.55, 1.67),
      synthLeg(2, "g2", "p2", 0.65, 1.55, 1.67),
      synthLeg(3, "g3", "p3", 0.65, 1.55, 1.67),
      synthLeg(4, "g4", "p4", 0.65, 1.55, 1.67),
    ];
    const { bets } = buildMultis(picks, 8);
    const main = bets.find((m) => m.type === "mainPlay");
    expect(main).toBeDefined();
    const legs = main!.legs.map((id) => picks.find((p) => p.id === id)!).filter(Boolean);
    const combo = combinedBetPrice(legs);
    expect(combo).toBeGreaterThanOrEqual(5);
    expect(combo).toBeLessThanOrEqual(20);
  });
});