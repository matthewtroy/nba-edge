import { describe, expect, it } from "vitest";
import { FORBIDDEN_MULTI_CARD_STRINGS, multiCardPlainText } from "../src/components/MultiCard";
import type { MultiBet } from "../lib/types";

describe("MultiCard layout strings", () => {
  it("does not embed forbidden marketing strings in card metadata", () => {
    const multi: MultiBet = {
      type: "mainPlay",
      label: "Main Play",
      legs: [],
      combinedProbability: 0.1,
      combinedFairPrice: 10,
      combinedTakeAt: 9.99,
      combinedBestBookie: "Sportsbet",
      combinedBestPrice: 10.5,
      oneInX: 10,
      summary: "5 legs",
    };
    const blob = multiCardPlainText(multi);
    for (const bad of FORBIDDEN_MULTI_CARD_STRINGS) {
      expect(blob.includes(bad)).toBe(false);
    }
  });
});