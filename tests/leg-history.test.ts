import { describe, it, expect } from "vitest";
import { lastFiveVsLine } from "../lib/leg-history";

describe("lastFiveVsLine", () => {
  it("marks hits and misses", () => {
    const logs = [
      { gameId: "a", minutes: 30, pts: 22, reb: 5, ast: 3, threes: 2, date: "2026-01-05" },
      { gameId: "b", minutes: 30, pts: 18, reb: 5, ast: 3, threes: 2, date: "2026-01-04" },
    ];
    expect(lastFiveVsLine(logs, "pts", 20)).toEqual(["hit", "miss"]);
  });
});