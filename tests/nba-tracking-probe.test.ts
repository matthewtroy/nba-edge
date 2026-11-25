import { describe, expect, it } from "vitest";
import { NBA_STATS_HEADERS } from "../lib/nba-stats-headers";
import { blendRatesWithTracking } from "../lib/tracking-blend";

describe("nba tracking", () => {
  it("has GHA-style headers", () => {
    expect(NBA_STATS_HEADERS["x-nba-stats-origin"]).toBe("stats");
    expect(NBA_STATS_HEADERS.Referer).toContain("nba.com");
  });

  it("blends ast rate toward tracking signal", () => {
    const out = blendRatesWithTracking(
      { pts: 0.5, reb: 0.2, ast: 0.15, threes: 0.05 },
      {
        playerId: "1",
        playerName: "X",
        potentialAst: 11.2,
        source: "nba",
        cachedAt: "2026-11-26",
      },
      32
    );
    expect(out.ast).toBeGreaterThan(0.15);
  });
});