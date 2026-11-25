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

  it("returns up to five ticks without padding", () => {
    const logs = Array.from({ length: 7 }, (_, i) => ({
      gameId: `g${i}`,
      minutes: 30,
      pts: 10 + i,
      reb: 5,
      ast: 3,
      threes: 2,
      date: `2026-01-${String(20 - i).padStart(2, "0")}`,
    }));
    const ticks = lastFiveVsLine(logs, "pts", 12);
    expect(ticks).toHaveLength(5);
    expect(ticks).toEqual(["miss", "miss", "hit", "hit", "hit"]);
  });
});