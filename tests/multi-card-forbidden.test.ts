import { describe, expect, it } from "vitest";
import { FORBIDDEN_MULTI_CARD_STRINGS, multiCardPlainText } from "../src/components/MultiCard";
import type { MultiBet, PickLeg } from "../lib/types";

const leg: PickLeg = {
  id: "a",
  gameId: "g",
  team: "T",
  opponent: "O",
  playerId: "p",
  playerName: "Test Player",
  headshotUrl: "",
  market: "pts",
  line: 20,
  probability: 0.6,
  fairPrice: 1.6,
  takeAt: 1.73,
  tags: [],
  reasons: [],
};

describe("MultiCard layout strings", () => {
  it("does not embed forbidden strings", () => {
    const multi: MultiBet = {
      type: "mainPlay",
      label: "Main Play",
      legs: ["a"],
      combinedProbability: 0.1,
      combinedFairPrice: 6.77,
      combinedTakeAt: 9.99,
      oneInX: 10,
      summary: "starter main lines",
    };
    const blob = multiCardPlainText(multi, [leg]);
    for (const bad of FORBIDDEN_MULTI_CARD_STRINGS) {
      expect(blob.includes(bad)).toBe(false);
    }
    expect(blob).toContain("Take at $9.99+ once (Fair $6.77)");
  });
});