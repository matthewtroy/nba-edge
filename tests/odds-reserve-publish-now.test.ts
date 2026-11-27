import { describe, expect, it } from "vitest";
import { oddsPullReserveCredits, oddsReserveCredits } from "../lib/odds-reserve";
import { shouldPauseForReserve, officialPublishAffordable } from "../lib/odds-budget";
import { shouldPauseOdds } from "../lib/odds";

describe("publish_now reserve override", () => {
  it("publish_now uses reserve 0; scheduled keeps ODDS_RESERVE_CREDITS", () => {
    expect(oddsPullReserveCredits(true)).toBe(0);
    expect(oddsPullReserveCredits(false)).toBe(oddsReserveCredits());
    expect(oddsReserveCredits()).toBe(20);
  });

  it("107 remaining: publish_now affords 11×8+1; scheduled does not", () => {
    expect(officialPublishAffordable(107, 11, 8, 0).ok).toBe(true);
    expect(officialPublishAffordable(107, 11, 8, 20).ok).toBe(false);
    expect(officialPublishAffordable(88, 11, 8, 0).ok).toBe(false);
  });

  it("shouldPauseForReserve and shouldPauseOdds respect publish_now reserve 0", () => {
    expect(shouldPauseForReserve(107, 0)).toBe(false);
    expect(shouldPauseForReserve(19, 20)).toBe(true);
    expect(shouldPauseForReserve(19, 0)).toBe(false);
    expect(shouldPauseOdds(107, 500, 0)).toBe(false);
    expect(shouldPauseOdds(107, 500, 20)).toBe(false);
    expect(shouldPauseOdds(15, 500, 20)).toBe(true);
  });
});