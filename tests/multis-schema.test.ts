import { describe, expect, it } from "vitest";
import type { MultiBet } from "../lib/types";
import { loadPublishedMultis } from "./public-data-fixture";

const multis = loadPublishedMultis("2026-11-25");

describe("multis.json schema", () => {
  it("has bestBookie fields and no stake/oneInX", () => {
    for (const b of multis.bets) {
      const bet = b as MultiBet & { oneInX?: number; stakeSuggestion?: number };
      expect(bet.oneInX).toBeUndefined();
      expect(bet.stakeSuggestion).toBeUndefined();
      expect(bet.bookieTotals).toBeDefined();
      const totals = Object.keys(bet.bookieTotals ?? {});
      if (totals.length === 0) {
        if (
          bet.type === "q1Multi" ||
          bet.combinedBestPrice != null ||
          bet.bestBookieTotal != null ||
          bet.bestBookie != null ||
          bet.type === "crossGameSgm" ||
          bet.type === "boostSgm" ||
          bet.type === "longshot" ||
          bet.type === "mainPlay" ||
          bet.type === "booster"
        ) {
          continue;
        }
      }
      expect(totals.length).toBeGreaterThan(0);
      if (bet.bestBookie && bet.bestBookieTotal != null) {
        expect(bet.bookieTotals![bet.bestBookie]).toBe(bet.bestBookieTotal);
      }
    }
  });
});