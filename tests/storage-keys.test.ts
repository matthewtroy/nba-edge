import { describe, expect, it } from "vitest";
import type { MultiBet } from "../lib/types";
import { multiBookieStorageKey } from "../src/hooks/useMultiBookieSelect";
import { crossGameStorageKey } from "../src/hooks/useCrossGameSelection";

const multi: MultiBet = {
  type: "crossGameSgm",
  label: "Cross",
  legs: ["a", "b"],
  combinedProbability: 0.1,
  combinedFairPrice: 10,
  combinedTakeAt: 12,
  summary: "test",
};

describe("localStorage keys", () => {
  it("separates today vs games bookie scope", () => {
    const today = multiBookieStorageKey(multi, "today");
    const games = multiBookieStorageKey(multi, "games");
    expect(today).toContain(":today:");
    expect(games).toContain(":games:");
    expect(today).not.toBe(games);
  });

  it("scopes cross-game chips by slate date", () => {
    const k1 = crossGameStorageKey(multi, "2026-11-26");
    const k2 = crossGameStorageKey(multi, "2026-11-27");
    expect(k1).toContain("cross-games:today:2026-11-26");
    expect(k2).toContain("2026-11-27");
    expect(k1).not.toBe(k2);
  });
});