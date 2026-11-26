import { describe, expect, it } from "vitest";
import {
  formTextIsSupportive,
  isSupportiveReason,
  rankTextIsSupportive,
} from "../lib/leg-reason-supportive";
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

describe("pass 8b item 3 — form hit-rate gates", () => {
  it("≥25% prob needs ≥60% hit rate", () => {
    expect(formTextIsSupportive("6/10 at this line", 0.5)).toBe(true);
    expect(formTextIsSupportive("5/10 at this line", 0.5)).toBe(false);
    expect(formTextIsSupportive("5/5 at this line", 0.5)).toBe(true);
  });

  it("<25% prob: rate > p and hits ≥2", () => {
    expect(formTextIsSupportive("3/10 at this line", 0.09)).toBe(true);
    expect(formTextIsSupportive("1/10 at this line", 0.09)).toBe(false);
    expect(formTextIsSupportive("2/10 at this line", 0.22)).toBe(false);
  });
});
