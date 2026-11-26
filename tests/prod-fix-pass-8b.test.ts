import { describe, expect, it } from "vitest";
import { isSupportiveReason, rankTextIsSupportive } from "../lib/leg-reason-supportive";
import type { PickLeg } from "../lib/types";

const baseLeg = {
  id: "1",
  gameId: "g",
  team: "T",
  opponent: "O",
  playerId: "p",
  playerName: "Test",
  headshotUrl: "",
  market: "reb" as const,
  line: 5,
  probability: 0.55,
  fairPrice: 1.8,
  takeAt: 1.95,
  tags: [],
  reasons: [],
  starterEligible: true,
} as PickLeg;

describe("pass 8b item 2 — position rank supportive", () => {
  it("rank with avg ≥ line is supportive at fair odds", () => {
    const text = "Averages 10.0 reb, 3rd of 20 centers";
    expect(rankTextIsSupportive(text, { ...baseLeg, line: 8 })).toBe(true);
    expect(isSupportiveReason({ type: "rank", text }, { ...baseLeg, line: 8 })).toBe(
      true
    );
  });

  it("rank below line or outside top 15 is not supportive", () => {
    const text = "Averages 10.0 reb, 3rd of 20 centers";
    expect(rankTextIsSupportive(text, { ...baseLeg, line: 12 })).toBe(false);
    const low = "Averages 12.0 reb, 18th of 20 centers";
    expect(rankTextIsSupportive(low, { ...baseLeg, line: 5 })).toBe(false);
  });
});
