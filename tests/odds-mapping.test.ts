import { describe, it, expect } from "vitest";
import { overLineToModelRung, isOverOutcome } from "../lib/odds";

describe("overLineToModelRung", () => {
  it("maps Over 0.5 → 1+", () => {
    expect(overLineToModelRung(0.5)).toBe(1);
  });
  it("maps Over 1.5 → 2+", () => {
    expect(overLineToModelRung(1.5)).toBe(2);
  });
  it("maps Over 24.5 → 25+", () => {
    expect(overLineToModelRung(24.5)).toBe(25);
  });
  it("maps whole-number Over 10 → 10+", () => {
    expect(overLineToModelRung(10)).toBe(10);
    expect(overLineToModelRung(25)).toBe(25);
  });
});

describe("isOverOutcome", () => {
  it("accepts Over only", () => {
    expect(isOverOutcome("Over 1.5")).toBe(true);
    expect(isOverOutcome("Franz Wagner 2+")).toBe(true);
    expect(isOverOutcome("Under 1.5")).toBe(false);
  });
});