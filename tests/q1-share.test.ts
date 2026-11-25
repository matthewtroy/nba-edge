import { describe, expect, it } from "vitest";
import { q1Share } from "../lib/baseline";
import type { PlayerGameLog } from "../lib/types";

describe("q1Share", () => {
  it("uses q1Reb when estimating reb share, not only q1Pts games", () => {
    const logs: PlayerGameLog[] = [
      {
        gameId: "1",
        minutes: 32,
        pts: 20,
        reb: 10,
        ast: 4,
        threes: 2,
        q1Pts: 6,
        q1Reb: 4,
        q1Ast: 1,
        date: "2025-11-20",
      },
      {
        gameId: "2",
        minutes: 30,
        pts: 18,
        reb: 8,
        ast: 3,
        threes: 1,
        q1Pts: 5,
        q1Reb: 3,
        q1Ast: 0,
        date: "2025-11-18",
      },
      {
        gameId: "3",
        minutes: 31,
        pts: 22,
        reb: 9,
        ast: 5,
        threes: 2,
        q1Pts: 7,
        q1Reb: 2,
        q1Ast: 2,
        date: "2025-11-16",
      },
    ];
    const rebShare = q1Share(logs, "reb");
    expect(rebShare).toBeGreaterThan(0.2);
    expect(rebShare).toBeLessThan(0.5);
    expect(q1Share(logs, "pts")).toBeGreaterThan(0.2);
  });
});