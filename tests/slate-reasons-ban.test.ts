import { describe, expect, it } from "vitest";
import { buildLegReasons } from "../lib/leg-reason-builder";
import {
  BANNED_REASON_PHRASES,
  reasonTextHasBannedPhrase,
} from "../lib/reason-ban";
import type { PickLeg, PlayerGameLog } from "../lib/types";

const baseLeg = {
  id: "1",
  gameId: "g",
  team: "T",
  opponent: "O",
  playerId: "p",
  playerName: "Test",
  headshotUrl: "",
  market: "pts" as const,
  line: 20,
  probability: 0.55,
  fairPrice: 1.8,
  takeAt: 1.95,
  tags: [],
  reasons: [],
  starterEligible: true,
} as PickLeg;

function logsWithAvg(avg: number): PlayerGameLog[] {
  return Array.from({ length: 10 }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    pts: avg,
    reb: 5,
    ast: 3,
    threes: 1,
    minutes: 32,
  }));
}

describe("slate reason copy", () => {
  it("flags banned phrases", () => {
    for (const phrase of BANNED_REASON_PHRASES) {
      expect(reasonTextHasBannedPhrase(`bad ${phrase} line`)).toBe(phrase);
    }
  });

  it("omits avg reason when L10 below line", () => {
    const reasons = buildLegReasons({
      leg: baseLeg,
      logs: logsWithAvg(15),
    });
    const avg = reasons.find((r) => r.type === "avg");
    expect(avg).toBeUndefined();
  });

  it("avg reason uses above-line template", () => {
    const reasons = buildLegReasons({
      leg: baseLeg,
      logs: logsWithAvg(24),
    });
    const avg = reasons.find((r) => r.type === "avg");
    expect(avg?.text).toMatch(/above 20\+ line/);
    expect(reasonTextHasBannedPhrase(avg?.text ?? "")).toBeNull();
  });

  it("form reason needs 7/10 or 5/5", () => {
    const reasons = buildLegReasons({
      leg: { ...baseLeg, line: 50 },
      logs: logsWithAvg(24),
    });
    const form = reasons.find((r) => r.type === "form");
    expect(form).toBeUndefined();
  });
});