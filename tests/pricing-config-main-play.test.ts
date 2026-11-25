import { describe, expect, it } from "vitest";
import {
  MAIN_PLAY_COMBINED_MIN,
  MAIN_PLAY_COMBINED_MAX,
  MAIN_PLAY_HIGH_PROB_P,
  MAIN_PLAY_L10_GAP_PP,
} from "../lib/pricing-config";

describe("MAIN_PLAY pricing-config", () => {
  it("sliding combined total $5–$20", () => {
    expect(MAIN_PLAY_COMBINED_MIN).toBe(5);
    expect(MAIN_PLAY_COMBINED_MAX).toBe(20);
  });

  it("re-exports thresholds from main-play-eligibility", async () => {
    const el = await import("../lib/main-play-eligibility");
    expect(el.MAIN_PLAY_HIGH_PROB_P).toBe(MAIN_PLAY_HIGH_PROB_P);
    expect(el.MAIN_PLAY_L10_GAP_PP).toBe(MAIN_PLAY_L10_GAP_PP);
  });
});