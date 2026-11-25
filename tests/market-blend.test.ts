import { describe, it, expect } from "vitest";
import {
  blendProbability,
  borrowMarketImplied,
  CHECK_NEWS_PP,
  impliedFromDecimalPrice,
} from "../lib/market-blend";

describe("market blend", () => {
  it("60% market / 40% model blend", () => {
    const p = blendProbability(0.7, 0.5);
    expect(p).toBeCloseTo(0.58, 2);
  });

  it("borrow from nearest priced rung", () => {
    const implied = borrowMarketImplied(20, [
      { line: 25, price: 2.0 },
      { line: 15, price: 1.4 },
    ]);
    expect(implied).toBeDefined();
    expect(implied!).toBeGreaterThan(impliedFromDecimalPrice(2));
  });

  it("check news threshold 15pp", () => {
    expect(CHECK_NEWS_PP).toBe(0.15);
  });
});