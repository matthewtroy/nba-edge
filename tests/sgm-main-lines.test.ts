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
  line: 1,
  probability: 0.5,
  fairPrice: 2,
  takeAt: 2.1,
  starterEligible: true,
  tags: [],
  reasons: [],
};

describe("SGM main lines", () => {
  it("allows any 3pm 1+ everywhere (no 2+/4+ floor)", () => {
    expect(isSgmMainLine("3pm", 1)).toBe(true);
    expect(isSgmMainLine("3pm", 2)).toBe(true);
    expect(isSgmMainLine("3pm", 4)).toBe(true);
    expect(gateLineViolation({ ...base, line: 1 }, false)).toBeNull();
    expect(gateLineViolation({ ...base, line: 2 }, false)).toBeNull();
    expect(gateLineViolation({ ...base, line: 0 }, false)).toMatch(/need 1\+/);
    expect(qualifiesCrossBoostLeg({ ...base, line: 1, fairPrice: 1.5, takeAt: 1.62 })).toBe(true);
  });
});
