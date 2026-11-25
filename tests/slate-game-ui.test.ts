import { describe, expect, it } from "vitest";
import { gamesForCards, isGameFinal, isGameLive } from "../lib/slate-game-ui";
import type { SlateGame } from "../lib/types";

const g = (status: string): SlateGame => ({
  id: "1",
  startTime: "2026-11-26T10:00:00Z",
  startTimeSydney: "9pm",
  homeTeam: "Home",
  awayTeam: "Away",
  homeTeamId: "h",
  awayTeamId: "a",
  homeB2B: false,
  awayB2B: false,
  status,
});

describe("slate game UI", () => {
  it("hides finals and detects live", () => {
    expect(isGameFinal("Final")).toBe(true);
    expect(isGameLive("In Progress")).toBe(true);
    const slate = [g("Final"), g("Scheduled"), g("In Progress")];
    expect(gamesForCards(slate).map((x) => x.status)).toEqual([
      "Scheduled",
      "In Progress",
    ]);
  });
});