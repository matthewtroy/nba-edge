import { describe, expect, it } from "vitest";
import {
  formatGameOddsAge,
  formatOddsFreshnessSummary,
  sydneyOddsClock,
} from "../lib/odds-freshness-ui";
import type { PickLeg, SlateGame } from "../lib/types";

const slate: SlateGame[] = [
  {
    id: "g1",
    startTime: "2026-11-26T10:00:00Z",
    startTimeSydney: "9pm",
    homeTeam: "A",
    awayTeam: "B",
    homeTeamId: "1",
    awayTeamId: "2",
    homeB2B: false,
    awayB2B: false,
    status: "Scheduled",
  },
  {
    id: "g2",
    startTime: "2026-11-26T12:00:00Z",
    startTimeSydney: "11pm",
    homeTeam: "C",
    awayTeam: "D",
    homeTeamId: "3",
    awayTeamId: "4",
    homeB2B: false,
    awayB2B: false,
    status: "Scheduled",
  },
];

function leg(gameId: string, pulled: string): PickLeg {
  return {
    id: `${gameId}-pts-10`,
    gameId,
    team: "T",
    opponent: "O",
    playerId: "p",
    playerName: "P",
    headshotUrl: "",
    market: "pts",
    line: 10,
    probability: 0.6,
    fairPrice: 1.7,
    takeAt: 1.85,
    tags: [],
    reasons: [],
    bookiePrices: { Ladbrokes: 1.9 },
    oddsPulledAt: pulled,
    starterEligible: true,
  } as PickLeg;
}

describe("odds freshness ui", () => {
  it("groups games by pull time for header", () => {
    const picks = [
      leg("g1", "2026-11-26T10:29:00.000Z"),
      leg("g1", "2026-11-26T10:29:00.000Z"),
      leg("g2", "2026-11-26T05:16:00.000Z"),
    ];
    const summary = formatOddsFreshnessSummary(picks, slate);
    expect(summary).toMatch(/^Odds /);
    expect(summary).toContain("1 game");
    expect(summary).toContain("·");
  });

  it("formats game odds age", () => {
    const picks = [leg("g1", "2026-11-26T05:16:00.000Z")];
    const age = formatGameOddsAge(picks, "g1");
    expect(age).toMatch(/^odds /);
    expect(sydneyOddsClock("2026-11-26T05:16:00.000Z")).toBeTruthy();
  });
});