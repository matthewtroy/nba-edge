import { describe, expect, it } from "vitest";
import { buildMultis } from "../lib/multis";
import type { PickLeg } from "../lib/types";
import { legPriceAtBookie } from "../lib/single-bookie";

function lineLeg(
  opts: Partial<PickLeg> & Pick<PickLeg, "id" | "gameId" | "playerId" | "playerName" | "market" | "line" | "fairPrice" | "bookiePrices">
): PickLeg {
  const sb = opts.bookiePrices?.Sportsbet ?? opts.bookiePrices?.SportsBet ?? 1.5;
  return {
    team: "T",
    opponent: "O",
    headshotUrl: "",
    probability: 0.75,
    takeAt: opts.fairPrice * 1.08,
    starter: true,
    starterEligible: true,
    tags: ["High probability"],
    reasons: [{ type: "form", text: "8/10 at this line" }],
    recentTenVsLine: Array(10).fill("hit"),
    bestPrice: sb,
    bestBookie: "Sportsbet",
  ...opts,
    bookiePrices: { Sportsbet: sb, SportsBet: sb, ...opts.bookiePrices },
  };
}

describe("Booster Sportsbet next rung", () => {
  it("main ast 5 with SB 7/8/10 uses 7 not 10", () => {
    const picks: PickLeg[] = [
      lineLeg({
        id: "spencer-ast-5",
        gameId: "g1",
        playerId: "spencer",
        playerName: "Cam Spencer",
        market: "ast",
        line: 5,
        fairPrice: 1.31,
        bookiePrices: { Sportsbet: 1.96 },
      }),
      lineLeg({
        id: "spencer-ast-7",
        gameId: "g1",
        playerId: "spencer",
        playerName: "Cam Spencer",
        market: "ast",
        line: 7,
        fairPrice: 1.55,
        probability: 0.55,
        bookiePrices: { Sportsbet: 2.4 },
      }),
      lineLeg({
        id: "spencer-ast-8",
        gameId: "g1",
        playerId: "spencer",
        playerName: "Cam Spencer",
        market: "ast",
        line: 8,
        fairPrice: 1.7,
        probability: 0.55,
        bookiePrices: { Sportsbet: 2.75 },
      }),
      lineLeg({
        id: "spencer-ast-10",
        gameId: "g1",
        playerId: "spencer",
        playerName: "Cam Spencer",
        market: "ast",
        line: 10,
        fairPrice: 2.2,
        probability: 0.55,
        bookiePrices: { Sportsbet: 4.0 },
      }),
      lineLeg({
        id: "p2-pts-15",
        gameId: "g2",
        playerId: "p2",
        playerName: "Player 2",
        market: "pts",
        line: 15,
        fairPrice: 1.45,
        bookiePrices: { Sportsbet: 1.9 },
      }),
      lineLeg({
        id: "p2-pts-20",
        gameId: "g2",
        playerId: "p2",
        playerName: "Player 2",
        market: "pts",
        line: 20,
        fairPrice: 1.75,
        bookiePrices: { Sportsbet: 2.55 },
      }),
      lineLeg({
        id: "p3-pts-15",
        gameId: "g3",
        playerId: "p3",
        playerName: "Player 3",
        market: "pts",
        line: 15,
        fairPrice: 1.45,
        bookiePrices: { Sportsbet: 1.9 },
      }),
      lineLeg({
        id: "p3-pts-20",
        gameId: "g3",
        playerId: "p3",
        playerName: "Player 3",
        market: "pts",
        line: 20,
        fairPrice: 1.75,
        bookiePrices: { Sportsbet: 2.55 },
      }),
    ];
    const { bets } = buildMultis(picks, 3);
    const main = bets.find((b) => b.type === "mainPlay");
    const booster = bets.find((b) => b.type === "booster");
    expect(main).toBeDefined();
    expect(booster?.bestBookie).toBe("Sportsbet");
    const byId = new Map(picks.map((p) => [p.id, p]));
    expect(main!.legs.map((id) => byId.get(id)!.line)).toContain(5);
    const spencerBoost = booster!.legs
      .map((id) => byId.get(id)!)
      .find((l) => l.playerId === "spencer");
    expect(spencerBoost?.line).toBe(7);
    expect(legPriceAtBookie(spencerBoost!, "Sportsbet")).toBe(2.4);
  });
});