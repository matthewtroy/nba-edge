import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { buildMultis } from "../lib/multis";
import { gateAllMultis } from "../lib/multi-gate";
import type { PickLeg } from "../lib/types";

function leg(
  id: string,
  line: number,
  fair: number,
  price: number,
  tags: string[] = ["High probability"]
): PickLeg {
  return {
    id,
    gameId: `g-${id}`,
    team: "T",
    opponent: "O",
    playerId: id.split("-")[0]!,
    playerName: id,
    headshotUrl: "",
    market: "pts",
    line,
    probability: 0.72,
    fairPrice: fair,
    takeAt: fair * 1.08,
    starter: true,
    starterEligible: true,
    tags,
    reasons: [{ type: "form", text: "8/10 at this line" }],
    recentTenVsLine: Array(10).fill("hit"),
    bookiePrices: { Sportsbet: price },
    bestBookie: "Sportsbet",
    bestPrice: price,
  };
}

describe("builder matches gate — booster and longshot", () => {
  it("Longshot pre-filter drops Check news; take-at stays 30–150", () => {
    const picks: PickLeg[] = [
      { ...leg("p1", 35, 8, 12), gameId: "g1", playerId: "p1" },
      { ...leg("p2", 40, 9, 14, ["Check news"]), gameId: "g2", playerId: "p2" },
      { ...leg("p3", 45, 10, 16), gameId: "g3", playerId: "p3" },
      { ...leg("p4", 50, 12, 20), gameId: "g4", playerId: "p4" },
    ];
    const { bets, notBuilt } = buildMultis(picks, 4);
    const ls = bets.find((b) => b.type === "longshot");
    const pmap = new Map(picks.map((p) => [p.id, p]));
    if (ls) {
      const legs = ls.legs.map((id) => pmap.get(id)!);
      expect(legs.some((l) => l.tags.includes("Check news"))).toBe(false);
      expect(ls.combinedTakeAt).toBeGreaterThanOrEqual(30);
      expect(ls.combinedTakeAt).toBeLessThanOrEqual(150);
      const g = gateAllMultis(bets, pmap, picks);
      expect(g.dropped.filter((m) => m.type === "longshot")).toHaveLength(0);
    } else {
      expect(notBuilt.some((n) => n.type === "longshot")).toBe(true);
    }
  });

  it("2026-11-28 fixture: booster builds or notBuilt reports legs tried", () => {
    const picksPath = path.join(
      process.cwd(),
      "public/data/2026-11-28/picks.json"
    );
    if (!fs.existsSync(picksPath)) {
      return;
    }
    const picks = JSON.parse(fs.readFileSync(picksPath, "utf8")) as PickLeg[];
    const slateSize = new Set(picks.map((p) => p.gameId)).size;
    const { bets, notBuilt, gateViolations } = buildMultis(picks, slateSize);
    expect(gateViolations).toHaveLength(0);
    const pmap = new Map(picks.map((p) => [p.id, p]));
    const g = gateAllMultis(bets, pmap, picks);
    expect(g.dropped).toHaveLength(0);
    const booster = bets.find((b) => b.type === "booster");
    const nb = notBuilt.find((n) => n.type === "booster");
    expect(booster != null || nb != null).toBe(true);
    if (nb) expect(nb.reason).toMatch(/legs tried at/i);
  });
});