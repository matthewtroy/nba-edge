import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { buildMultis } from "../lib/multis";
import {
  MAIN_PLAY_EDGE_AT_MAX,
  MAIN_PLAY_EDGE_AT_MIN,
  actualEdgeFraction,
  edgeSurplus,
  formatEdgeShortfall,
  requiredEdge,
} from "../lib/pricing-config";
import type { PickLeg } from "../lib/types";

function leg(
  id: string,
  overrides: Partial<PickLeg> & {
    gameId: string;
    playerId: string;
    probability: number;
    bookiePrices: Record<string, number>;
  }
): PickLeg {
  const probability = overrides.probability;
  const fairPrice = Math.round((1 / probability) * 100) / 100;
  const bookie = Object.keys(overrides.bookiePrices)[0];
  const bestPrice = overrides.bookiePrices[bookie];
  return {
    team: "T",
    opponent: "O",
    playerName: id,
    headshotUrl: "",
    market: "pts",
    line: 20,
    takeAt: Math.round(fairPrice * 1.08 * 100) / 100,
    tags: ["High probability"],
    reasons: [{ type: "form", text: "8/10 at this line" }],
    reasonLine: "8/10 hits at line · Soft defence rank 8",
    starterEligible: true,
    recentTenVsLine: [
      "hit",
      "hit",
      "hit",
      "hit",
      "hit",
      "hit",
      "hit",
      "hit",
      "miss",
      "miss",
    ],
    bestBookie: bookie,
    bestPrice,
    fairPrice,
    ...overrides,
    id,
    probability,
    fairPrice,
  };
}

describe("Main Play requiredEdge curve", () => {
  it("EDGE_AT_MIN/MAX and linear requiredEdge($5→10%, $20→75%)", () => {
    expect(MAIN_PLAY_EDGE_AT_MIN).toBe(0.1);
    expect(MAIN_PLAY_EDGE_AT_MAX).toBe(0.75);
    expect(requiredEdge(5)).toBeCloseTo(0.1, 10);
    expect(requiredEdge(20)).toBeCloseTo(0.75, 10);
    expect(requiredEdge(14.2)).toBeCloseTo(0.1 + (14.2 - 5) * (0.65 / 15), 10);
  });

  it("formatEdgeShortfall matches example shape", () => {
    expect(formatEdgeShortfall(14.2, 0.38, 0.5)).toBe(
      "$14.20, needs 50% edge, has 38%"
    );
  });

  it("wires shortfall copy into Main Play notBuilt path", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "lib/multis.ts"), "utf8");
    expect(src).toMatch(/formatEdgeShortfall/);
    expect(src).toMatch(/Main Play edge shortfall/);
    expect(src).toMatch(/edgeSurplus/);
  });

  it("picks higher surplus over lower surplus in band", () => {
    const mk = (bookie: string, price: number): PickLeg[] =>
      [0, 1, 2, 3].map((i) =>
        leg(`L${bookie}${i}`, {
          gameId: `g${i}`,
          playerId: `p${bookie}${i}`,
          probability: 0.7,
          bookiePrices: { [bookie]: price },
        })
      );

    const fair = 1 / 0.7 ** 4;
    expect(edgeSurplus(1.85 ** 4, fair)).toBeGreaterThan(edgeSurplus(1.55 ** 4, fair));

    const { bets } = buildMultis([...mk("Ladbrokes", 1.55), ...mk("Unibet", 1.85)], 8);
    const main = bets.find((b) => b.type === "mainPlay");
    expect(main).toBeTruthy();
    expect(main!.bestBookie).toBe("Unibet");
    const total = main!.bestBookieTotal!;
    expect(actualEdgeFraction(total, main!.combinedFairPrice) + 1e-9).toBeGreaterThanOrEqual(
      requiredEdge(total)
    );
  });
});
