import { describe, it, expect } from "vitest";
import { shouldPauseOdds } from "../lib/odds";

describe("odds credit limit", () => {
  it("pauses below 20% monthly", () => {
    expect(shouldPauseOdds(99, 500)).toBe(true);
    expect(shouldPauseOdds(150, 500)).toBe(false);
  });
});