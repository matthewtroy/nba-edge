import { describe, expect, it } from "vitest";
import { displayTagsForBookie, hasValueAtBookie } from "../lib/value-at-bookie";
import type { PickLeg } from "../lib/types";

const leg = (bookiePrices: Record<string, number>, takeAt = 1.9): PickLeg =>
  ({
    id: "l1",
    takeAt,
    tags: ["Value", "High probability"],
    bookiePrices,
    market: "pts",
    line: 20,
    playerName: "X",
  }) as PickLeg;

describe("value at card bookie", () => {
  it("drops Value tag when card bookie is below take-at", () => {
    const l = leg({ bet365: 1.5, Sportsbet: 2.1 });
    expect(hasValueAtBookie(l, "bet365")).toBe(false);
    expect(hasValueAtBookie(l, "Sportsbet")).toBe(true);
    expect(displayTagsForBookie(l, "bet365")).not.toContain("Value");
    expect(displayTagsForBookie(l, "Sportsbet")).toContain("Value");
  });
});