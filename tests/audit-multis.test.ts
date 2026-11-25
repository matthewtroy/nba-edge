import { describe, expect, it } from "vitest";
import { auditMultisForToday } from "../lib/audit-multis";
import type { MetaJson, MultiBet, PickLeg } from "../lib/types";

describe("auditMultisForToday", () => {
  it("flags cross-book, check news, below take-at, tip lock", () => {
    const leg: PickLeg = {
      id: "a",
      gameId: "g",
      team: "T",
      opponent: "O",
      playerId: "p",
      playerName: "Star",
      headshotUrl: "",
      market: "pts",
      line: 20,
      probability: 0.6,
      fairPrice: 1.6,
      takeAt: 1.8,
      bestPrice: 1.7,
      tags: ["Check news"],
      reasons: [],
    };
    const multi: MultiBet = {
      type: "mainPlay",
      label: "Main Play",
      legs: ["a"],
      combinedProbability: 0.5,
      combinedFairPrice: 2,
      combinedTakeAt: 1.8,
      bookieTotals: {},
      summary: "",
    };
    const meta: MetaJson = {
      lastUpdated: "",
      sources: { espn: "ok", nbaOfficial: "ok", odds: "ok (tip lock — kept cache)" },
      slateSize: 1,
    };
    const issues = auditMultisForToday({
      multis: [multi],
      picksById: new Map([["a", leg]]),
      meta,
    });
    expect(issues.some((i) => i.includes("tip lock"))).toBe(true);
    expect(issues.some((i) => i.includes("Check news"))).toBe(true);
    expect(issues.some((i) => i.includes("below take-at"))).toBe(true);
    expect(issues.some((i) => i.includes("check bet365"))).toBe(true);
  });
});