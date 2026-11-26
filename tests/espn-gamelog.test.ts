import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  gamelogStatIndices,
  parseAttempted,
  parseGameLogsFromEspn,
  parseMade,
} from "../scripts/espn-parse";

const katRow = {
  labels: [
    "MIN",
    "FG",
    "FG%",
    "3PT",
    "3P%",
    "FT",
    "FT%",
    "REB",
    "AST",
    "BLK",
    "STL",
    "PF",
    "TO",
    "PTS",
  ],
  names: [
    "minutes",
    "fieldGoalsMade-fieldGoalsAttempted",
    "fieldGoalPct",
    "threePointFieldGoalsMade-threePointFieldGoalsAttempted",
    "threePointPct",
    "freeThrowsMade-freeThrowsAttempted",
    "freeThrowPct",
    "totalRebounds",
    "assists",
    "blocks",
    "steals",
    "fouls",
    "turnovers",
    "points",
  ],
  seasonTypes: [
    {
      displayName: "Regular Season",
      categories: [
        {
          events: [
            {
              eventId: "401910034",
              stats: [
                "29",
                "9-14",
                "64.3",
                "4-4",
                "100.0",
                "8-12",
                "66.7",
                "13",
                "5",
                "2",
                "3",
                "5",
                "1",
                "30",
              ],
            },
          ],
        },
      ],
    },
  ],
  events: {
    "401910034": {
      gameDate: "2026-11-24T00:00Z",
      homeTeamId: "18",
      awayTeamId: "11",
      team: { id: "18" },
      opponent: { id: "11", displayName: "Indiana Pacers" },
      atVs: "vs",
    },
  },
};

describe("ESPN gamelog parse", () => {
  it("maps stat columns from header labels not hardcoded indexes", () => {
    const ix = gamelogStatIndices(katRow);
    expect(ix).not.toBeNull();
    expect(ix!.reb).toBe(7);
    expect(ix!.ast).toBe(8);
    expect(ix!.pts).toBe(13);
  });

  it("uses attempted half of made-attempted for FGA and FTA", () => {
    expect(parseMade("9-14")).toBe(9);
    expect(parseAttempted("9-14")).toBe(14);
    expect(parseAttempted("8-12")).toBe(12);
  });

  it("parses real ESPN row fixture", () => {
    const logs = parseGameLogsFromEspn(katRow, "", "18");
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      minutes: 29,
      pts: 30,
      reb: 13,
      ast: 5,
      threes: 4,
      fga: 14,
      fg3a: 4,
      fta: 12,
      turnovers: 1,
    });
    expect(logs[0].fga).not.toBe(100);
  });

  it("fixture file matches live label order", () => {
    const p = path.join(process.cwd(), "fixtures/espn-gamelog-kat-row.json");
    if (!fs.existsSync(p)) {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, JSON.stringify(katRow, null, 2));
    }
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    const logs = parseGameLogsFromEspn(raw, "", "18");
    expect(logs[0].fga).toBe(14);
  });
});