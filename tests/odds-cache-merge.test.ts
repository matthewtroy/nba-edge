import { describe, expect, it } from "vitest";
import { mergeBestOddsMaps } from "../lib/odds-cache-merge";

describe("mergeBestOddsMaps", () => {
  it("keeps previous map on empty post-tip pull", () => {
    const prev = new Map([["a|pts|10", { price: 1.5, bookie: "TAB" }]]);
    const merged = mergeBestOddsMaps(prev, new Map(), { postTipOff: true });
    expect(merged.get("a|pts|10")?.price).toBe(1.5);
  });

  it("merges incoming keys without dropping prior post-tip", () => {
    const prev = new Map([["a|pts|10", { price: 1.5, bookie: "TAB" }]]);
    const inc = new Map([["b|pts|15", { price: 2.1, bookie: "Sportsbet" }]]);
    const merged = mergeBestOddsMaps(prev, inc, { postTipOff: true });
    expect(merged.size).toBe(2);
  });
});