import { describe, expect, it } from "vitest";
import { bookieMarketLabel, bookieOverLine, marketLabel } from "../lib/market-label";

describe("bookieMarketLabel", () => {
  it("maps model rungs to Over lines", () => {
    expect(bookieOverLine(25)).toBe(24.5);
    expect(bookieOverLine(1)).toBe(0.5);
    expect(bookieMarketLabel("pts", 25)).toBe("Over 24.5 pts");
    expect(marketLabel("pts", 25)).toBe("25+ pts");
  });

  it("handles milestone markets", () => {
    expect(bookieMarketLabel("dd", 1)).toBe("Double-double");
    expect(bookieMarketLabel("3pm", 2)).toBe("Over 1.5 3PM");
  });
});