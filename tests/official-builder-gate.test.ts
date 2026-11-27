import { describe, expect, it } from "vitest";
import { buildMultis } from "../lib/multis";
import { gateAllMultis } from "../lib/multi-gate";
import type { PickLeg } from "../lib/types";

function synth(
  id: string,
  gameId: string,
  playerId: string,
  market: string,
  line: number,
  fair: number,
  price: number,
  probability = 0.74
): PickLeg {
  return {
    id,
    gameId,
    team: "T",
    opponent: "O",
    playerId,
    playerName: id,
    headshotUrl: "",
    market,
    line,
    probability,
    fairPrice: fair,
    takeAt: fair * 1.08,
    starter: true,
    starterEligible: true,
    tags: ["High probability"],
    reasons: [{ type: "form", text: "8/10 at this line" }],
    recentTenVsLine: Array(10).fill("hit"),
    bookiePrices: { Sportsbet: price },
    bestPrice: price,
    bestBookie: "Sportsbet",
  };
}

describe("official builders vs gate", () => {
  it("Main Play: gate drops zero built multis", () => {
    const picks: PickLeg[] = [
      synth("a", "g1", "p1", "pts", 15, 1.45, 1.7),
      synth("b", "g2", "p2", "pts", 15, 1.45, 1.7),
      synth("c", "g3", "p3", "pts", 15, 1.45, 1.7),
      synth("d", "g4", "p4", "pts", 15, 1.45, 1.7),
    ];
    const { bets } = buildMultis(picks, 4);
    const pmap = new Map(picks.map((p) => [p.id, p]));
    const g = gateAllMultis(bets, pmap, picks);
    expect(g.dropped).toHaveLength(0);
  });

  it("Double Up: weak top leg skipped, second pair can build", () => {
    const weak = synth("weak", "g1", "w", "pts", 15, 1.45, 1.42, 0.74);
    weak.recentTenVsLine = Array(10).fill("miss");
    const strong = [
      { ...synth("s1", "g2", "s1", "pts", 15, 1.42, 1.56), fairPrice: 1.42 },
      { ...synth("s2", "g3", "s2", "pts", 15, 1.3, 1.41), fairPrice: 1.3 },
    ];
    const picks = [weak, ...strong];
    const { bets } = buildMultis(picks, 2);
    const du = bets.find((b) => b.type === "doubleUp");
    expect(du).toBeDefined();
    expect(du!.legs).not.toContain(weak.id);
  });
});