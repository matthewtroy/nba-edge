import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { applyInjuryRedistribution } from "../lib/injury-redistribution";
import {
  applyInjuryCombineActuals,
  loadInjuryCombineLog,
  mergeInjuryCombineEntries,
  writeInjuryCombineLog,
} from "../lib/injury-combine-log";
import { measuredSplitEffect } from "../lib/injury-combine-measured";
import {
  combineTeammateInjuryReasonForMarket,
  injuryReasonForMarket,
} from "../lib/injury-reason";
import type { InjuryEntry, PlayerProfile } from "../lib/types";
import { perMinuteRates, projectBaseline, projectedMinutes } from "../lib/baseline";

function profile(
  id: string,
  name: string,
  logs: import("../lib/types").PlayerGameLog[]
): PlayerProfile {
  return {
    id,
    name,
    teamId: "1",
    teamName: "Team",
    position: "G",
    headshotUrl: "",
    seasonAvgMinutes: 30,
    gameLogs: logs,
  };
}

describe("injury combine measured", () => {
  it("≤0 split yields zero effect and no out reason", () => {
    const cur = { pts: 20, reb: 5, ast: 8, threes: 2, minutes: 32 };
    const logs = [
      { gameId: "a", minutes: 32, pts: 18, reb: 5, ast: 10, threes: 1, date: "2026-11-01" },
      { gameId: "b", minutes: 30, pts: 16, reb: 4, ast: 9, threes: 1, date: "2026-11-02" },
      { gameId: "c", minutes: 32, pts: 14, reb: 3, ast: 8, threes: 0, date: "2026-11-03" },
      { gameId: "d", minutes: 34, pts: 22, reb: 6, ast: 12, threes: 2, date: "2026-11-04" },
    ];
    const injuredIds = new Set(["star-a", "star-b", "star-c"]);
    const { effect } = measuredSplitEffect(logs, injuredIds, cur, "ast", 0.25);
    expect(effect).toBe(0);
  });

  it("sum of positives capped at 25% baseline stat", () => {
    const star: PlayerProfile = profile("star", "Star", [
      { gameId: "a", minutes: 34, pts: 26, reb: 4, ast: 8, threes: 2, date: "2026-11-01" },
      { gameId: "b", minutes: 35, pts: 28, reb: 3, ast: 9, threes: 3, date: "2026-11-02" },
      { gameId: "c", minutes: 33, pts: 24, reb: 5, ast: 7, threes: 1, date: "2026-11-03" },
    ]);
    const wing = profile("wing", "Wing", [
      { gameId: "a", minutes: 32, pts: 18, reb: 5, ast: 3, threes: 1, date: "2026-11-01" },
      { gameId: "b", minutes: 33, pts: 20, reb: 4, ast: 2, threes: 2, date: "2026-11-02" },
      { gameId: "c", minutes: 31, pts: 16, reb: 6, ast: 4, threes: 1, date: "2026-11-03" },
      { gameId: "d", minutes: 34, pts: 22, reb: 5, ast: 3, threes: 2, date: "2026-11-04" },
      { gameId: "e", minutes: 30, pts: 8, reb: 2, ast: 7, threes: 0, date: "2026-11-05" },
      { gameId: "f", minutes: 31, pts: 7, reb: 2, ast: 8, threes: 0, date: "2026-11-06" },
    ]);
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
    const before = base.get("wing")!.ast;
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
    const { adjusted, reasons } = applyInjuryRedistribution(
      { players: [star, wing], injuries: [injury], gameLogsByPlayer: logs },
      base,
      rates
    );
    const after = adjusted.get("wing")!.ast;
    expect(after - before).toBeLessThanOrEqual(before * 0.25 + 0.15);
    expect((reasons.get("wing") ?? []).every((t) => !/out:\s*-/i.test(t))).toBe(true);
  });

  it("joint override when two outs share ≥2 without games", () => {
    const out1 = profile("o1", "Alpha", [
      { gameId: "g1", minutes: 30, pts: 20, reb: 5, ast: 5, threes: 1, date: "2026-11-01" },
      { gameId: "g2", minutes: 30, pts: 20, reb: 5, ast: 5, threes: 1, date: "2026-11-02" },
      { gameId: "g3", minutes: 30, pts: 19, reb: 5, ast: 4, threes: 1, date: "2026-11-03" },
    ]);
    const out2 = profile("o2", "Beta", [
      { gameId: "g1", minutes: 28, pts: 15, reb: 8, ast: 2, threes: 0, date: "2026-11-01" },
      { gameId: "g2", minutes: 28, pts: 15, reb: 8, ast: 2, threes: 0, date: "2026-11-02" },
      { gameId: "g3", minutes: 28, pts: 14, reb: 7, ast: 2, threes: 0, date: "2026-11-03" },
    ]);
    const ben = profile("ben", "Beneficiary", [
      { gameId: "g1", minutes: 30, pts: 10, reb: 3, ast: 4, threes: 0, date: "2026-11-01" },
      { gameId: "g2", minutes: 30, pts: 10, reb: 3, ast: 4, threes: 0, date: "2026-11-02" },
      { gameId: "g3", minutes: 32, pts: 14, reb: 4, ast: 8, threes: 1, date: "2026-11-03" },
      { gameId: "g4", minutes: 32, pts: 15, reb: 4, ast: 9, threes: 1, date: "2026-11-04" },
      { gameId: "g5", minutes: 31, pts: 13, reb: 3, ast: 7, threes: 0, date: "2026-11-05" },
    ]);
    const logs = new Map([
      [out1.id, out1.gameLogs],
      [out2.id, out2.gameLogs],
      [ben.id, ben.gameLogs],
    ]);
    const rates = new Map();
    const base = new Map();
    for (const p of [out1, out2, ben]) {
      const r = perMinuteRates(p.gameLogs)!;
      rates.set(p.id, r);
      base.set(p.id, projectBaseline(r, projectedMinutes(p.gameLogs)));
    }
    const injuries: InjuryEntry[] = [
      {
        playerId: "o1",
        playerName: "Alpha",
        teamId: "1",
        teamName: "Team",
        gameId: "gx",
        status: "Out",
        source: "t",
        updatedAt: "",
      },
      {
        playerId: "o2",
        playerName: "Beta",
        teamId: "1",
        teamName: "Team",
        gameId: "gx",
        status: "Out",
        source: "t",
        updatedAt: "",
      },
    ];
    const { combineLog } = applyInjuryRedistribution(
      { players: [out1, out2, ben], injuries, gameLogsByPlayer: logs },
      base,
      rates,
      { slateDate: "2026-11-28" }
    );
    expect(combineLog.length).toBeGreaterThan(0);
    expect(combineLog.some((e) => e.method === "joint")).toBe(true);
  });

  it("no Q/D/P lines in Out combine display", () => {
    const reasons = [
      "Pippen out: +1.1 ast",
      "Edey questionable → +0.4 ast",
      "Role risk: Grant doubtful",
    ];
    expect(injuryReasonForMarket(reasons, "ast")).toBe("Pippen out → +1.1 ast");
    expect(combineTeammateInjuryReasonForMarket(reasons, "ast")).not.toMatch(/questionable|doubtful/i);
  });

  it("persist log and settle actual stat", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "inj-combine-"));
    const filePath = path.join(tmp, "injury-combine-log.json");
    const entry = {
      slateDate: "2026-11-28",
      playerId: "ben",
      playerName: "Beneficiary",
      stat: "ast" as const,
      outSplits: [],
      method: "sum" as const,
      combinedBoost: 2,
      appliedBoost: 2,
      loggedAt: new Date().toISOString(),
    };
    writeInjuryCombineLog(filePath, mergeInjuryCombineEntries(empty(), [entry]));
    const loaded = loadInjuryCombineLog(filePath);
    const settled = applyInjuryCombineActuals(loaded, "2026-11-28", new Map([
      ["ben", { pts: 10, reb: 3, ast: 11 }],
    ]));
    expect(settled.entries[0]!.actualStat).toBe(11);
  });
});

function empty() {
  return loadInjuryCombineLog("/nonexistent");
}