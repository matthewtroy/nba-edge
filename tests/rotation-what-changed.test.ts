import { describe, expect, it } from "vitest";
import { buildWhatChanged } from "../lib/what-changed";
import type { InjuryEntry, PickLeg, PlayerGameLog } from "../lib/types";

const fringeLogs: PlayerGameLog[] = [
  { gameId: "1", minutes: 6, pts: 2, reb: 1, ast: 0, threes: 0, date: "2025-11-20" },
  { gameId: "2", minutes: 8, pts: 3, reb: 2, ast: 0, threes: 0, date: "2025-11-18" },
  { gameId: "3", minutes: 5, pts: 0, reb: 1, ast: 0, threes: 0, date: "2025-11-16" },
];

describe("what-changed rotation filter", () => {
  it("drops fringe injured → star bump lines", () => {
    const injuries: InjuryEntry[] = [
      {
        playerId: "fringe",
        playerName: "Amari Williams",
        teamId: "bos",
        teamName: "Boston Celtics",
        gameId: "g1",
        status: "Out",
        source: "NBA Official",
        updatedAt: "",
      },
    ];
    const picks: PickLeg[] = [
      {
        id: "tatum",
        gameId: "g1",
        team: "Boston Celtics",
        opponent: "Magic",
        playerId: "tatum",
        playerName: "Jayson Tatum",
        headshotUrl: "",
        market: "pts",
        line: 25,
        probability: 0.7,
        fairPrice: 1.5,
        takeAt: 1.62,
        projectedMinutes: 36,
        tags: [],
        reasons: ["Amari Williams out: +2.7 pts"],
      },
    ];
    const lines = buildWhatChanged(injuries, picks, 3, {
      playerLogsById: new Map([
        ["fringe", fringeLogs],
        ["tatum", Array(10).fill({
          gameId: "x",
          minutes: 35,
          pts: 25,
          reb: 7,
          ast: 5,
          threes: 3,
          date: "2025-11-20",
        })],
      ]),
    });
    expect(lines.some((l) => l.includes("Amari Williams"))).toBe(false);
  });
});