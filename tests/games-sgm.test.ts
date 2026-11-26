import { describe, expect, it } from "vitest";
import { gameSgmBlocks, renderGamesText } from "../lib/games-sgm";
import type { MultiBet, PickLeg, SlateGame } from "../lib/types";

const game: SlateGame = {
  id: "g1",
  startTime: "2026-11-25T10:00:00Z",
  startTimeSydney: "9:00 pm",
  homeTeam: "Boston Celtics",
  awayTeam: "Brooklyn Nets",
  homeTeamId: "h1",
  awayTeamId: "a1",
  homeB2B: false,
  awayB2B: false,
  status: "pre",
};

const leg = (id: string, overrides: Partial<PickLeg> = {}): PickLeg =>
  ({
    id,
    gameId: "g1",
    playerName: "Player",
    market: "pts",
    line: 20,
    takeAt: 1.5,
    fairPrice: 1.8,
    probability: 0.6,
    starterEligible: true,
    tags: [],
    headshotUrl: "",
    team: "BOS",
    opponent: "BKN",
    playerId: id,
    reasons: [{ type: "form", text: "7/10 at this line" }],
    ...overrides,
  }) as PickLeg;

describe("games SGM", () => {
  it("groups SGM pool per game", () => {
    const picks = [
      leg("l1", { fairPrice: 1.9 }),
      leg("l2", { market: "3pm", line: 2, fairPrice: 1.5, starterEligible: false }),
    ];
    const blocks = gameSgmBlocks([game], picks, [], new Map(picks.map((p) => [p.id, p])));
    expect(blocks[0].sgmLegs.length).toBe(1);
  });

  it("renders proof text", () => {
    const multi: MultiBet = {
      type: "crossGameSgm",
      label: "Cross-Game SGM Multi",
      legs: ["l1"],
      combinedProbability: 0.1,
      combinedFairPrice: 10,
      combinedTakeAt: 10.8,
      summary: "",
    };
    const picks = [
      leg("l1", { fairPrice: 1.55, probability: 0.65, line: 15 }),
      leg("l2", { fairPrice: 1.6, probability: 0.62, playerName: "B", line: 10, market: "reb" }),
      leg("l3", { fairPrice: 1.7, probability: 0.58, playerName: "C", line: 5, market: "ast" }),
    ];
    const text = renderGamesText({
      slate: [game],
      picks,
      multis: [multi],
    });
    expect(text).toContain("Games");
    expect(text).toMatch(
      /SGM @|not enough starter legs|nothing fits|No game SGM/i
    );
  });
});