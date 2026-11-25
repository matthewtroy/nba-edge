import { describe, it, expect } from "vitest";
import { applyInjuryRedistribution } from "../lib/injury-redistribution";
import type { InjuryEntry, PlayerProfile } from "../lib/types";
import { perMinuteRates, projectedMinutes, projectBaseline } from "../lib/baseline";

describe("injury redistribution", () => {
  it("boosts teammate when star is out", () => {
    const star: PlayerProfile = {
      id: "star",
      name: "Star",
      teamId: "1",
      teamName: "Team",
      position: "PF",
      headshotUrl: "",
      seasonAvgMinutes: 35,
      gameLogs: [
        { gameId: "a", minutes: 36, pts: 28, reb: 8, ast: 5, threes: 2, date: "2026-11-01" },
        { gameId: "b", minutes: 34, pts: 26, reb: 7, ast: 4, threes: 1, date: "2026-11-02" },
        { gameId: "c", minutes: 35, pts: 30, reb: 9, ast: 6, threes: 2, date: "2026-11-03" },
      ],
    };
    const wing: PlayerProfile = {
      id: "wing",
      name: "Wing",
      teamId: "1",
      teamName: "Team",
      position: "SF",
      headshotUrl: "",
      seasonAvgMinutes: 32,
      gameLogs: [
        { gameId: "a", minutes: 32, pts: 18, reb: 5, ast: 3, threes: 1, date: "2026-11-01" },
        { gameId: "b", minutes: 33, pts: 20, reb: 4, ast: 2, threes: 2, date: "2026-11-02" },
        { gameId: "c", minutes: 31, pts: 16, reb: 6, ast: 4, threes: 1, date: "2026-11-03" },
        { gameId: "d", minutes: 34, pts: 22, reb: 5, ast: 3, threes: 2, date: "2026-11-04" },
      ],
    };
    const logs = new Map([
      [star.id, star.gameLogs],
      [wing.id, wing.gameLogs],
    ]);
    const rates = new Map();
    const base = new Map();
    for (const p of [star, wing]) {
      const r = perMinuteRates(p.gameLogs)!;
      rates.set(p.id, r);
      base.set(p.id, projectBaseline(r, projectedMinutes(p.gameLogs)));
    }
    const before = base.get("wing")!.pts;
    const injury: InjuryEntry = {
      playerId: "star",
      playerName: "Star",
      teamId: "1",
      teamName: "Team",
      gameId: "g",
      status: "Out",
      source: "test",
      updatedAt: "",
    };
    const { adjusted } = applyInjuryRedistribution(
      { players: [star, wing], injuries: [injury], gameLogsByPlayer: logs },
      base,
      rates
    );
    expect(adjusted.get("wing")!.pts).toBeGreaterThan(before);
    expect(adjusted.has("star")).toBe(false);
  });
});