import { describe, expect, it } from "vitest";
import type { PlayerGameLog } from "../lib/types";
import { logsForModelRates, perMinuteRates } from "../lib/baseline";
import {
  modelRatesLogCount,
  stampLegacyLogSources,
} from "../lib/game-log-normalize";

function legacyRow(i: number): PlayerGameLog {
  return {
    gameId: `g${i}`,
    date: "2026-11-20",
    minutes: 32,
    pts: 18,
    reb: 5,
    ast: 4,
    threes: 2,
  };
}

describe("game log normalize", () => {
  it("treats missing source as espn for model rates", () => {
    const logs = [0, 1, 2, 3, 4].map(legacyRow);
    expect(modelRatesLogCount(logs)).toBe(5);
    const stamped = stampLegacyLogSources(logs);
    expect(stamped[0].source).toBe("espn");
    expect(perMinuteRates(stamped)).not.toBeNull();
  });

  it("excludes boxscore-only rows from rates", () => {
    const logs = [0, 1, 2].map((i) => ({
      ...legacyRow(i),
      source: "boxscore" as const,
    }));
    expect(logsForModelRates(logs)).toHaveLength(0);
  });
});