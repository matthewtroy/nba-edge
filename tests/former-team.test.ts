import { describe, expect, it } from "vitest";
import { formerTeamOpponentTag } from "../lib/former-team";
import type { PlayerGameLog } from "../lib/types";

describe("former_team tag", () => {
  it("tags traded player facing former team", () => {
    const logs: PlayerGameLog[] = [
      {
        gameId: "g1",
        date: "2024-12-01",
        minutes: 30,
        pts: 10,
        reb: 5,
        ast: 3,
        threes: 1,
        teamId: "bos",
        opponentTeamId: "okc",
      },
      {
        gameId: "g2",
        date: "2026-11-01",
        minutes: 32,
        pts: 12,
        reb: 6,
        ast: 4,
        threes: 1,
        teamId: "okc",
        opponentTeamId: "bos",
      },
    ];
    expect(
      formerTeamOpponentTag({
        logs,
        currentTeamId: "okc",
        opponentTeamId: "bos",
      })
    ).toBe(true);
  });
});