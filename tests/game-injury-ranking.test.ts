import { describe, expect, it } from "vitest";
import { rankGamesByInjuryAngle } from "../lib/game-injury-ranking";
import type { InjuryEntry, PickLeg, SlateGame } from "../lib/types";

const games: SlateGame[] = [
  {
    id: "g1",
    startTime: "2026-11-26T02:00:00Z",
    startTimeSydney: "",
    homeTeam: "Heat",
    awayTeam: "Knicks",
    homeTeamId: "m1",
    awayTeamId: "m2",
    total: 220,
    homeB2B: false,
    awayB2B: false,
    status: "pre",
  },
  {
    id: "g2",
    startTime: "2026-11-26T04:00:00Z",
    startTimeSydney: "",
    homeTeam: "Lakers",
    awayTeam: "Celtics",
    homeTeamId: "m3",
    awayTeamId: "m4",
    total: 228,
    homeB2B: false,
    awayB2B: false,
    status: "pre",
  },
];

describe("rankGamesByInjuryAngle", () => {
  it("orders by injury score with total tiebreak", () => {
    const injuries: InjuryEntry[] = [
      {
        playerId: "em",
        playerName: "Joel Embiid",
        teamId: "m2",
        teamName: "Knicks",
        gameId: "g1",
        status: "Out",
        source: "ESPN",
        updatedAt: "",
      },
    ];
    const picks: PickLeg[] = [
      {
        id: "d1",
        gameId: "g1",
        team: "Knicks",
        opponent: "Heat",
        playerId: "dr",
        playerName: "Andre Drummond",
        headshotUrl: "",
        market: "reb",
        line: 10,
        probability: 0.6,
        fairPrice: 1.6,
        takeAt: 1.73,
        tags: [],
        reasons: ["Embiid out: +6 reb"],
        projectedMinutes: 24,
      },
    ];
    const ranked = rankGamesByInjuryAngle(games, injuries, picks);
    expect(ranked[0].gameId).toBe("g1");
    expect(ranked[0].score).toBeGreaterThan(0);
  });
});