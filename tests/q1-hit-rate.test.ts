import { describe, expect, it } from "vitest";
import { q1HitRateLast10 } from "../lib/leg-history";
import type { PlayerGameLog } from "../lib/types";

function logs(q1Pts: (number | undefined)[]): PlayerGameLog[] {
  return q1Pts.map((q1, i) => ({
    gameId: `g${i}`,
    date: `2026-11-${String(20 - i).padStart(2, "0")}`,
    minutes: 30,
    pts: 20,
    reb: 5,
    ast: 4,
    threes: 2,
    q1Pts: q1,
  }));
}

describe("q1HitRateLast10", () => {
  it("returns hit fraction over last 10 with Q1 data", () => {
    const hr = q1HitRateLast10(logs([8, 7, 6, 9, 5, 8, 7, 6, 5, 4]), "q1pts", 7);
    expect(hr).toBeCloseTo(0.5, 1);
  });
});