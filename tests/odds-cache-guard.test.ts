import { describe, expect, it } from "vitest";
import {
  countPricedPickLegs,
  mergeGlobalOddsMapRecord,
  oddsMapDowngradeBlocked,
  persistDataBranchGuardReason,
} from "../lib/odds-cache-guard";
import type { PickLeg } from "../lib/types";

describe("oddsMapDowngradeBlocked", () => {
  it("blocks empty replacement when prior had keys", () => {
    expect(oddsMapDowngradeBlocked(100, 0, { forceOddsPullSucceeded: false })).toBe(true);
  });

  it("allows empty when force odds succeeded", () => {
    expect(oddsMapDowngradeBlocked(100, 0, { forceOddsPullSucceeded: true })).toBe(false);
  });

  it("blocks >50% shrink", () => {
    expect(oddsMapDowngradeBlocked(1000, 400, { forceOddsPullSucceeded: false })).toBe(true);
    expect(oddsMapDowngradeBlocked(1000, 600, { forceOddsPullSucceeded: false })).toBe(false);
  });
});

describe("mergeGlobalOddsMapRecord", () => {
  it("keeps prior when incoming is empty", () => {
    const prior = { "a|pts|10": { price: 1.5, bookie: "TAB" } };
    expect(mergeGlobalOddsMapRecord(prior, {}, { forceOddsPullSucceeded: false })).toEqual(prior);
  });
});

describe("persistDataBranchGuardReason", () => {
  it("blocks 0 priced legs when same slate had prices", () => {
    expect(
      persistDataBranchGuardReason({
        defaultSlateDate: "2026-11-26",
        pricedLegs: 0,
        priorPricedLegsOnSlate: 8,
        priorSlateCacheKeys: 100,
        nextSlateCacheKeys: 0,
        forceOdds: false,
      })
    ).toMatch(/0 priced/);
  });

  it("allows new slate 0 priced with no prior on that folder", () => {
    expect(
      persistDataBranchGuardReason({
        defaultSlateDate: "2026-11-27",
        pricedLegs: 0,
        priorPricedLegsOnSlate: 0,
        priorSlateCacheKeys: 0,
        nextSlateCacheKeys: 0,
        forceOdds: false,
      })
    ).toBeNull();
  });

  it("allows shrink when force_odds", () => {
    expect(
      persistDataBranchGuardReason({
        defaultSlateDate: "2026-11-26",
        pricedLegs: 0,
        priorPricedLegsOnSlate: 8,
        priorSlateCacheKeys: 100,
        nextSlateCacheKeys: 0,
        forceOdds: true,
      })
    ).toBeNull();
  });
});

describe("countPricedPickLegs", () => {
  it("counts bestPrice and bookiePrices", () => {
    const legs = [
      { bestPrice: 1.8 } as PickLeg,
      { bookiePrices: { TAB: 2.1 } } as PickLeg,
      { bestPrice: 1 } as PickLeg,
    ];
    expect(countPricedPickLegs(legs)).toBe(2);
  });
});