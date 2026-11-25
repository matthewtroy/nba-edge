import { describe, expect, it } from "vitest";
import { filterH2hLogs, h2hReasonPhrase } from "../lib/h2h-reason";
import type { PlayerGameLog } from "../lib/types";

function oppLogs(ast: number[]): PlayerGameLog[] {
  return ast.map((a, i) => ({
    gameId: `g${i}`,
    date: `2025-11-${String(10 - i).padStart(2, "0")}`,
    minutes: 32,
    pts: 20,
    reb: 8,
    ast: a,
    threes: 1,
    opponentTeamId: "phx",
  }));
}

describe("h2h reasons", () => {
  it("needs at least 3 meetings", () => {
    const logs = oppLogs([7, 8]);
    expect(
      h2hReasonPhrase({
        logs,
        playerId: "p1",
        defendingTeamId: "phx",
        market: "ast",
        line: 6,
        opponentName: "Phoenix Suns",
      })
    ).toBeUndefined();
  });

  it("emits standout h2h copy", () => {
    const logs = oppLogs([8, 9, 7, 10, 8]);
    const text = h2hReasonPhrase({
      logs,
      playerId: "p1",
      defendingTeamId: "phx",
      market: "ast",
      line: 6,
      opponentName: "Phoenix Suns",
      seasonAvg: { pts: 20, reb: 8, ast: 7, threes: 1 },
    });
    expect(text).toMatch(/vs Suns|vs Phoenix|of 5|Hit 6\+/);
    expect(filterH2hLogs(logs, "phx").length).toBe(5);
  });
});