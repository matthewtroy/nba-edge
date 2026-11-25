import { describe, expect, it } from "vitest";
import { checkModelSanity } from "../lib/model-sanity";
import type { PlayerGameLog } from "../lib/types";

function log(i: number, pts: number, reb: number, ast: number, min = 30): PlayerGameLog {
  return {
    gameId: `g${i}`,
    date: `2026-11-${10 + i}`,
    minutes: min,
    pts,
    reb,
    ast,
    threes: 1,
    source: "espn",
  };
}

describe("model sanity", () => {
  it("flags projection far from season rate × minutes", () => {
    const logs = Array.from({ length: 6 }, (_, i) => log(i, 20, 5, 4));
    const result = checkModelSanity([
      {
        playerName: "Test",
        gameLogs: logs,
        projected: { pts: 5, reb: 5, ast: 4, threes: 1, minutes: 32 },
      },
    ]);
    expect(result.failed).toBe(1);
    expect(result.blockRepublish).toBe(true);
  });

  it("passes when aligned with season rates", () => {
    const logs = Array.from({ length: 6 }, (_, i) => log(i, 16, 6, 4));
    const result = checkModelSanity([
      {
        playerName: "Test",
        gameLogs: logs,
        projected: { pts: 17, reb: 6.4, ast: 4.3, threes: 1, minutes: 32 },
      },
    ]);
    expect(result.failed).toBe(0);
    expect(result.blockRepublish).toBe(false);
  });
});