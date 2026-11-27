import { describe, expect, it } from "vitest";
import { buildRosterIndex } from "../lib/injury-match";
import { applyInjuryStatusLegTags, indexInjuriesForRoster } from "../lib/injury-leg-tags";
import { buildMultis } from "../lib/multis";
import type { InjuryEntry, PickLeg } from "../lib/types";

const roster = buildRosterIndex([
  {
    teamId: "15",
    athletes: [
      { id: "3032977", name: "Giannis Antetokounmpo" },
      { id: "4903027", name: "Cedric Coward" },
    ],
  },
]);

function leg(playerId: string, name: string, gameId: string): PickLeg {
  return {
    id: `${playerId}-reb-10`,
    gameId,
    team: "T",
    opponent: "O",
    playerId,
    playerName: name,
    headshotUrl: "",
    market: "reb",
    line: 10,
    probability: 0.75,
    fairPrice: 1.33,
    takeAt: 1.44,
    starter: true,
    starterEligible: true,
    tags: ["High probability"],
    reasons: [{ type: "form", text: "8/10 at this line" }],
    recentTenVsLine: Array(10).fill("hit"),
    bookiePrices: { Neds: 1.35 },
    bestBookie: "Neds",
    bestPrice: 1.35,
  };
}

describe("injury tag by name", () => {
  it("indexes injury without playerId via normalised name + team", () => {
    const inj: InjuryEntry = {
      playerName: "Giannis Antetokounmpo",
      teamId: "15",
      teamName: "Milwaukee Bucks",
      gameId: "g",
      status: "Questionable",
      source: "NBA Official",
      updatedAt: "2026-11-28T00:00:00Z",
    };
    const unmatched: string[] = [];
    const map = indexInjuriesForRoster([inj], roster, unmatched);
    expect(unmatched).toEqual([]);
    expect(map.get("3032977")?.status).toBe("Questionable");
  });

  it("Q/D adds Check news and questionable on all legs", () => {
    const all = [
      leg("3032977", "Giannis Antetokounmpo", "g1"),
      { ...leg("3032977", "Giannis Antetokounmpo", "g1"), id: "3032977-pts-25", market: "pts" as const, line: 25 },
    ];
    const injuries: InjuryEntry[] = [
      {
        playerId: "3032977",
        playerName: "Giannis Antetokounmpo",
        teamId: "15",
        teamName: "Bucks",
        gameId: "g1",
        status: "Doubtful",
        source: "t",
        updatedAt: "",
      },
    ];
    applyInjuryStatusLegTags(all, injuries, roster);
    for (const l of all) {
      expect(l.tags).toContain("Check news");
      expect(l.questionable).toBe(true);
    }
  });

  it("Giannis Q/D excluded from Double Up and Cross", () => {
    const giannis = leg("3032977", "Giannis Antetokounmpo", "g1");
    giannis.tags.push("Check news");
    giannis.questionable = true;
    const coward = leg("4903027", "Cedric Coward", "g2");
    coward.id = "4903027-pts-15";
    coward.market = "pts";
    coward.line = 15;
    const others = ["g3", "g4", "g5", "g6", "g7", "g8"].map((g, i) => {
      const l = leg(`x${i}`, `Mate ${i}`, g);
      l.id = `x${i}-pts-15`;
      l.market = "pts";
      l.line = 15;
      l.playerId = `x${i}`;
      return l;
    });
    const picks = [giannis, coward, ...others];
    const { bets } = buildMultis(picks, 8);
    const du = bets.find((b) => b.type === "doubleUp");
    const cross = bets.find((b) => b.type === "crossGameSgm");
    if (du) expect(du.legs.every((id) => id !== giannis.id)).toBe(true);
    if (cross) expect(cross.legs.every((id) => id !== giannis.id)).toBe(true);
  });
});