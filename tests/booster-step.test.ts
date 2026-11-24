import { describe, expect, it } from "vitest";
import { buildMultis } from "../lib/multis";
import type { PickLeg } from "../lib/types";

function leg(id: string, pid: string, line: number, fair: number): PickLeg {
  return {
    id,
    gameId: `g-${pid}`,
    team: "T",
    opponent: "O",
    playerId: pid,
    playerName: pid,
    headshotUrl: "",
    market: "pts",
    line,
    probability: 1 / fair,
    fairPrice: fair,
    takeAt: fair * 1.05,
    starterEligible: true,
    tags: ["High probability"],
    reasons: [],
  };
}

function mainLeg(pid: string, market: "pts" | "ast", line: number, fair: number): PickLeg {
  return {
    id: `${pid}-${market}-${line}`,
    gameId: `g-${pid}`,
    team: "Home",
    opponent: "Away",
    playerId: pid,
    playerName: pid,
    headshotUrl: "",
    market,
    line,
    probability: 0.65,
    fairPrice: fair,
    takeAt: fair * 1.08,
    starterEligible: true,
    tags: ["High probability"],
    reasons: [],
    questionable: false,
    ageB2B: false,
  };
}

describe("Booster stepping", () => {
  it("steps every main leg one rung when booster builds", () => {
    const picks: PickLeg[] = [
      mainLeg("p1", "pts", 15, 1.55),
      mainLeg("p1", "pts", 20, 2.0),
      mainLeg("p2", "pts", 15, 1.55),
      mainLeg("p2", "pts", 20, 2.0),
      mainLeg("p3", "pts", 15, 1.55),
      mainLeg("p3", "pts", 20, 2.05),
      mainLeg("p4", "pts", 15, 1.55),
      mainLeg("p4", "pts", 20, 2.05),
    ];
    const { bets } = buildMultis(picks, 8);
    const main = bets.find((b) => b.type === "mainPlay");
    const booster = bets.find((b) => b.type === "booster");
    if (!main || !booster) return;
    const byId = new Map(picks.map((p) => [p.id, p]));
    for (const mid of main.legs) {
      const m = byId.get(mid)!;
      const bid = booster.legs.find((id) => byId.get(id)?.playerId === m.playerId);
      expect(bid).toBeDefined();
      const b = byId.get(bid!)!;
      expect(b.line).toBeGreaterThan(m.line);
    }
  });
});