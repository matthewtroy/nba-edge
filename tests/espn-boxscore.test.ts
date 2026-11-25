import { describe, expect, it } from "vitest";
import { boxStatIndices, parseBoxscorePlayerLogs } from "../scripts/espn-parse";

describe("espn boxscore parser", () => {
  it("maps boxscore keys to stat indices", () => {
    const ix = boxStatIndices([
      "minutes",
      "points",
      "fieldGoalsMade-fieldGoalsAttempted",
      "threePointFieldGoalsMade-threePointFieldGoalsAttempted",
      "freeThrowsMade-freeThrowsAttempted",
      "rebounds",
      "assists",
      "turnovers",
    ]);
    expect(ix).toEqual({
      min: 0,
      pts: 1,
      threes: 3,
      reb: 5,
      ast: 6,
      fga: 2,
      fta: 4,
      to: 7,
    });
  });

  it("parses player rows with correct pts/reb/ast", () => {
    const summary = {
      boxscore: {
        players: [
          {
            team: { id: "h1" },
            statistics: [
              {
                keys: [
                  "minutes",
                  "points",
                  "fieldGoalsMade-fieldGoalsAttempted",
                  "threePointFieldGoalsMade-threePointFieldGoalsAttempted",
                  "freeThrowsMade-freeThrowsAttempted",
                  "rebounds",
                  "assists",
                  "turnovers",
                ],
                athletes: [
                  {
                    athlete: { id: "p1", displayName: "Test Player" },
                    didNotPlay: false,
                    stats: ["32", "18", "7-12", "2-4", "2-2", "6", "5", "1"],
                  },
                  {
                    athlete: { id: "p2" },
                    didNotPlay: true,
                    stats: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    const rows = parseBoxscorePlayerLogs(summary, undefined, {
      gameId: "g1",
      date: "2026-11-20",
      homeTeamId: "h1",
      awayTeamId: "a1",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].log).toMatchObject({
      pts: 18,
      reb: 6,
      ast: 5,
      threes: 2,
      minutes: 32,
      source: "boxscore",
    });
  });
});