import { describe, expect, it } from "vitest";
import { evaluateOfficialPublishGate } from "../lib/official-card-gate";
import type { ModelPlayer } from "../scripts/model-engine";

const player = (id: string): ModelPlayer => ({
  id,
  name: id,
  teamId: "1",
  teamName: "T",
  position: "G",
  headshotUrl: "",
  gameId: "g1",
  opponent: "O",
  gameLogs: [0, 1, 2, 3, 4].map((i) => ({
    gameId: `g${i}`,
    date: "2026-11-20",
    minutes: 30,
    pts: 15,
    reb: 5,
    ast: 4,
    threes: 1,
    source: "espn" as const,
  })),
});

describe("official card gate", () => {
  it("does not block when model sanity fails >5%", () => {
    const gate = evaluateOfficialPublishGate({
      slateGameCount: 11,
      pickCount: 100,
      players: Array.from({ length: 20 }, (_, i) => player(`p${i}`)),
      sanity: { checked: 50, failed: 10, examples: ["x"], blockRepublish: true },
    });
    expect(gate.block).toBe(false);
  });

  it("blocks when games on slate but zero legs", () => {
    const gate = evaluateOfficialPublishGate({
      slateGameCount: 9,
      pickCount: 0,
      players: [player("a")],
      sanity: { checked: 0, failed: 0, examples: [], blockRepublish: false },
    });
    expect(gate.block).toBe(true);
    expect(gate.reasons.some((r) => r.includes("0 legs"))).toBe(true);
  });
});