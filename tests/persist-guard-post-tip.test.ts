import { describe, expect, it } from "vitest";
import { persistJsonShrinkReason } from "../lib/espn-cache-guard";
import { persistDataBranchGuardReason } from "../lib/odds-cache-guard";

describe("persist guard post-tip", () => {
  it("allows >20% ESPN cache shrink after tip-off", () => {
    expect(
      persistJsonShrinkReason("h2h-season-cache.json", 147, 51, { postTipOff: true })
    ).toBeNull();
  });

  it("still blocks post-tip empty wipes", () => {
    expect(
      persistJsonShrinkReason("h2h-season-cache.json", 147, 0, { postTipOff: true })
    ).toMatch(/post-tip empty wipe/);
  });

  it("skips priced-leg wipe when post-tip rebuild has no live prices", () => {
    expect(
      persistDataBranchGuardReason({
        defaultSlateDate: "2026-11-26",
        pricedLegs: 0,
        priorPricedLegsOnSlate: 1100,
        priorSlateCacheKeys: 900,
        nextSlateCacheKeys: 300,
        forceOdds: false,
      })
    ).toMatch(/0 priced/);
  });
});