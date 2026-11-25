import { describe, expect, it } from "vitest";
import {
  MAIN_PLAY_COMBINED_MIN,
  MAIN_PLAY_COMBINED_MAX,
  MAIN_PLAY_SWEET_MIN,
  MAIN_PLAY_SWEET_MAX,
  ROUGHIE_LEG_MIN,
  ROUGHIE_LEG_MAX,
  ROUGHIE_NORMAL_MIN,
  ROUGHIE_MAX_ROUGHIE_LEGS,
  ROUGHIE_MAX_LEGS,
  MAIN_PLAY_HIGH_PROB_P,
  MAIN_PLAY_L10_GAP_PP,
  compareMainPlayCandidates,
  mainPlayInSweetSpot,
} from "../lib/pricing-config";

describe("MAIN_PLAY pricing-config", () => {
  it("sliding combined total $5–$20", () => {
    expect(MAIN_PLAY_COMBINED_MIN).toBe(5);
    expect(MAIN_PLAY_COMBINED_MAX).toBe(20);
  });

  it("sweet spot band $6–$12", () => {
    expect(MAIN_PLAY_SWEET_MIN).toBe(6);
    expect(MAIN_PLAY_SWEET_MAX).toBe(12);
    expect(mainPlayInSweetSpot(11.59)).toBe(true);
    expect(mainPlayInSweetSpot(14.2)).toBe(false);
  });

  it("prefers sweet spot over higher surplus outside band", () => {
    const sweet = { total: 10, surplus: 1.0, p: 0.35 };
    const wide = { total: 18, surplus: 1.5, p: 0.4 };
    expect(compareMainPlayCandidates(sweet, wide)).toBeLessThan(0);
  });

  it("exports ROUGHIE_* for Games tab", () => {
    expect(ROUGHIE_LEG_MIN).toBe(2.5);
    expect(ROUGHIE_LEG_MAX).toBe(8);
    expect(ROUGHIE_NORMAL_MIN).toBe(1.35);
    expect(ROUGHIE_MAX_LEGS).toBe(5);
    expect(ROUGHIE_MAX_ROUGHIE_LEGS).toBe(2);
  });

  it("re-exports thresholds from main-play-eligibility", async () => {
    const el = await import("../lib/main-play-eligibility");
    expect(el.MAIN_PLAY_HIGH_PROB_P).toBe(MAIN_PLAY_HIGH_PROB_P);
    expect(el.MAIN_PLAY_L10_GAP_PP).toBe(MAIN_PLAY_L10_GAP_PP);
  });
});