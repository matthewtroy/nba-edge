import { describe, expect, it } from "vitest";
import { buildShortLegReason } from "../lib/leg-display";
import type { PickLeg, PlayerGameLog } from "../lib/types";

const base: PickLeg = {
  id: "x",
  gameId: "g",
  team: "T",
  opponent: "O",
  playerId: "p",
  playerName: "Test",
  headshotUrl: "",
  market: "reb",
  line: 5,
  probability: 0.7,
  fairPrice: 1.5,
  takeAt: 1.6,
  tags: [],
  reasons: ["Allen out → only big left: +3.4 reb"],
};

function logs(reb: number[]): PlayerGameLog[] {
  return reb.map((r, i) => ({
    gameId: `g${i}`,
    date: "2026-11-20",
    minutes: 30,
    pts: 10,
    reb: r,
    ast: 2,
    threes: 1,
    source: "espn" as const,
  }));
}

describe("buildShortLegReason", () => {
  it("prefers injury redistribution over form", () => {
    const line = buildShortLegReason(base, logs([6, 6, 6, 6, 6]));
    expect(line).toMatch(/Allen out/);
  });

  it("skips form below 7/10", () => {
    const leg = { ...base, reasons: [] };
    expect(buildShortLegReason(leg, logs([3, 3, 3, 3, 3, 8, 8, 8, 8, 8]))).toBeUndefined();
  });

  it("shows form at 7/10", () => {
    const leg = { ...base, reasons: [] };
    expect(buildShortLegReason(leg, logs([8, 8, 8, 8, 8, 8, 8, 3, 3, 3]))).toMatch(/7 of last 10/);
  });
});