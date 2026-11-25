import { describe, it, expect } from "vitest";
import { shouldPauseOdds } from "../lib/odds";

describe("odds credit limit", () => {
  it("pauses below flat reserve", () => {
    expect(shouldPauseOdds(19, 500, 20)).toBe(true);
    expect(shouldPauseOdds(25, 500, 20)).toBe(false);
  });
});