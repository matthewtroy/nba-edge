import { describe, expect, it } from "vitest";
import {
  bestEdgeMultiQuote,
  bookieTotalsForLegs,
  legMeetsBookieEdgeWithCatalog,
} from "../lib/best-multi-bookie";
import type { PickLeg } from "../lib/types";
import fs from "fs";
import path from "path";
import type { SlateGame } from "../lib/types";
import { buildGameSgmCard, isGameSgmCard } from "../lib/game-sgm-builder";

function leg(
  id: string,
  bookiePrices: Record<string, number>,
  takeAt = 1.5,
  fair = 1.45,
  p = 0.65
): PickLeg {
  return {
    id,
    playerId: id,
    playerName: id,
    gameId: "g",
    team: "T",
    opponent: "O",
    market: "pts",
    line: 10,
    probability: p,
    fairPrice: fair,
    takeAt,
    bestPrice: bookiePrices.Sportsbet,
    bestBookie: "Sportsbet",
    bookiePrices,
    tags: [],
    reasons: [{ type: "avg", text: "Avg over line" }],
    starterEligible: true,
  };
}

describe("bestEdgeMultiQuote", () => {
  it("picks highest total when every leg passes edge at that bookie", () => {
    const legs = [
      leg("a", { Sportsbet: 1.9, Ladbrokes: 1.85, TAB: 1.88 }),
      leg("b", { Sportsbet: 1.85, Ladbrokes: 1.95, TAB: 1.8 }),
    ];
    const quote = bestEdgeMultiQuote(legs, { buildBookie: "Sportsbet" });
    expect(quote?.bookie).toBe("Ladbrokes");
    expect(quote?.total).toBeCloseTo(1.95 * 1.85, 2);
  });

  it("tie-breaks to build bookie when totals match", () => {
    const legs = [
      leg("a", { Sportsbet: 2, TAB: 2 }),
      leg("b", { Sportsbet: 2, TAB: 2 }),
    ];
    const quote = bestEdgeMultiQuote(legs, { buildBookie: "Sportsbet" });
    expect(quote?.bookie).toBe("Sportsbet");
    expect(quote?.total).toBe(4);
  });

  it("skips bookies missing a leg price", () => {
    const legs = [
      leg("a", { Sportsbet: 2, TAB: 2 }),
      leg("b", { Sportsbet: 1.9 }),
    ];
    expect(bestEdgeMultiQuote(legs)).toEqual({ bookie: "Sportsbet", total: 3.8 });
  });

  it("skips bookies where any leg fails edge", () => {
    const legs = [
      leg("a", { Sportsbet: 2, TAB: 1.01 }, 2.5),
      leg("b", { Sportsbet: 2, TAB: 2 }, 1.5),
    ];
    expect(bestEdgeMultiQuote(legs)?.bookie).toBe("Sportsbet");
  });

  it("bookieTotalsForLegs lists each priced AU book", () => {
    const legs = [
      leg("a", { Sportsbet: 2, TAB: 1.8 }),
      leg("b", { Sportsbet: 1.5, TAB: 1.6 }),
    ];
    const totals = bookieTotalsForLegs(legs);
    expect(totals.Sportsbet).toBeCloseTo(3, 2);
    expect(totals.TAB).toBeCloseTo(2.88, 2);
  });
});

describe("games tab $50+ bookie totals from cache", () => {
  it("lists per-bookie combined totals for a built games-tab SGM", () => {
    const fixture = JSON.parse(
      fs.readFileSync(
        path.join(import.meta.dirname, "fixtures/games-tab-sac-bkn.json"),
        "utf8"
      )
    ) as { games: SlateGame[]; picks: PickLeg[] };
    const game = fixture.games.find((g) => g.id === "401909324");
    expect(game).toBeDefined();
    const picks = fixture.picks.filter((p) => p.gameId === game!.id);
    const built = buildGameSgmCard(game!, picks, 1.5, 8, 0.08, fixture.picks);
    expect(isGameSgmCard(built)).toBe(true);
    if (!isGameSgmCard(built)) return;
    const totals = bookieTotalsForLegs(built.legs);
    const paste = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([b, t]) => `${b}: $${t.toFixed(2)}`)
      .join(" · ");
    expect(paste).toMatch(/Sportsbet/);
    expect(built.bestBookie).toBe("Sportsbet");
    for (const legRow of built.legs) {
      expect(legMeetsBookieEdgeWithCatalog(legRow, built.bestBookie, fixture.picks)).toBe(
        true
      );
    }
    // $50+ band may not build on every fixture game; totals still come from cached leg prices.
    const fiftyBand = buildGameSgmCard(
      game!,
      picks,
      50,
      Number.POSITIVE_INFINITY,
      0.08,
      fixture.picks
    );
    if (isGameSgmCard(fiftyBand)) {
      expect(bookieTotalsForLegs(fiftyBand.legs).Sportsbet).toBeGreaterThanOrEqual(50);
    }
  });
});