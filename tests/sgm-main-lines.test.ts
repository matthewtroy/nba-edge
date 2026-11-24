import { describe, expect, it } from "vitest";
import { gateLineViolation, isSgmMainLine, qualifiesCrossBoostLeg } from "../lib/main-play-eligibility";
import type { PickLeg } from "../lib/types";

const base: PickLeg = {
  id: "1",
  gameId: "g",
  team: "T",
  opponent: "O",
  playerId: "p",
  playerName: "P",
  headshotUrl: "",
  market: "3pm",
  line: 2,
  probability: 0.5,
  fairPrice: 2,
  takeAt: 2.1,
  starterEligible: true,
  tags: [],
  reasons: [],
};

describe("SGM main lines", () => {
  it("forbids 2+ and 3+ threes outside Q1", () => {
    expect(isSgmMainLine("3pm", 2)).toBe(false);
    expect(isSgmMainLine("3pm", 3)).toBe(false);
    expect(isSgmMainLine("3pm", 4)).toBe(true);
    expect(gateLineViolation({ ...base, line: 2 }, false)).toMatch(/forbidden/);
    expect(qualifiesCrossBoostLeg({ ...base, line: 4 })).toBe(true);
  });
});