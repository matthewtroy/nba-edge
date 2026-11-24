import { describe, it, expect } from "vitest";
import { probPointsOver, probNbOver, REB_DISPERSION } from "../lib/distributions";

describe("distributions", () => {
  it("points over 20 at mean 25", () => {
    const p = probPointsOver(25, 20);
    expect(p).toBeGreaterThan(0.7);
    expect(p).toBeLessThan(0.95);
  });

  it("rebounds nb known-ish", () => {
    const p = probNbOver(8, REB_DISPERSION, 7);
    expect(p).toBeGreaterThan(0.4);
    expect(p).toBeLessThan(0.85);
  });
});