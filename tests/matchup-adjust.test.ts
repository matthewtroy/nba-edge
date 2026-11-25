import { describe, expect, it } from "vitest";
import { applyMatchupToModelP, matchupDeltaFromRank } from "../lib/matchup-adjust";

describe("matchupDeltaFromRank", () => {
  it("applies top3 full and bottom8 negative caps", () => {
    expect(matchupDeltaFromRank(1)).toBe(0.03);
    expect(matchupDeltaFromRank(5)).toBe(0.015);
    expect(matchupDeltaFromRank(25)).toBe(-0.03);
    expect(matchupDeltaFromRank(undefined)).toBe(0);
  });
});

describe("applyMatchupToModelP", () => {
  it("clamps after delta", () => {
    expect(applyMatchupToModelP(0.98, 0.03)).toBe(0.95);
    expect(applyMatchupToModelP(0.06, -0.03)).toBe(0.05);
  });
});