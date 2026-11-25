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
    const legs = [leg, { ...leg, id: "b" }, { ...leg, id: "c" }, { ...leg, id: "d" }];
    const p = 0.6 ** 4;
    const fair = Math.round((1 / p) * 100) / 100;
    const takeAt = Math.round(fair * 1.08 * 100) / 100;
    const multi: MultiBet = {
      type: "mainPlay",
      label: "Main Play",
      legs: legs.map((l) => l.id),
      combinedProbability: p,
      combinedFairPrice: fair,
      combinedTakeAt: takeAt,
      summary: "starter main lines",
    };
    const priced = legs.map((l, i) => ({
      ...l,
      id: l.id,
      bookiePrices: { Sportsbet: 1.9 + i * 0.05 },
      bestBookie: "Sportsbet",
      bestPrice: 1.9 + i * 0.05,
    }));
    const blob = multiCardPlainText(
      {
        ...multi,
        bestBookie: "Sportsbet",
        bestBookieTotal: priced.reduce((a, l) => a * (l.bestPrice ?? 1), 1),
      },
      priced
    );
    for (const bad of FORBIDDEN_MULTI_CARD_STRINGS) {
      expect(blob.includes(bad)).toBe(false);
    }
    expect(blob).toMatch(/@ \$[\d.]+/);
    expect(blob).toContain("Sportsbet");
    expect(blob.toLowerCase()).not.toContain("take at");
    expect(blob).not.toContain("once");
  });
});