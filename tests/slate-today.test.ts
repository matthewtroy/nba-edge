import { describe, expect, it } from "vitest";
import {
  filterOpenGamesOnSydneyDate,
  filterSlateToNextSydney,
  filterSlateToTodaySydney,
} from "../lib/slate-today";
import type { SlateGame } from "../lib/types";

function game(id: string, iso: string, status = "pre"): SlateGame {
  return {
    id,
    startTime: iso,
    startTimeSydney: "—",
    homeTeam: "Home",
    awayTeam: "Away",
    homeTeamId: "h",
    awayTeamId: "a",
    homeB2B: false,
    awayB2B: false,
    status,
  };
}

describe("slate today/next", () => {
  it("picks earliest then next Sydney tip dates", () => {
    const games = [
      game("g1", "2026-11-25T10:00:00Z"),
      game("g2", "2026-11-25T12:00:00Z"),
      game("g3", "2026-11-26T10:00:00Z"),
    ];
    expect(filterSlateToTodaySydney(games).map((g) => g.id)).toEqual(["g1", "g2"]);
    expect(filterSlateToNextSydney(games).map((g) => g.id)).toEqual(["g3"]);
  });

  it("filters by explicit Sydney date", () => {
    const games = [game("g3", "2026-11-26T10:00:00Z")];
    const tip = filterOpenGamesOnSydneyDate(games, "2026-11-26");
    expect(tip).toHaveLength(1);
  });
});