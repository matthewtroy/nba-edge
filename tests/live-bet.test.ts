import { describe, expect, it } from "vitest";
import { activeLegStates, liveBetView } from "../lib/live-bet";
import type { LiveLegState } from "../lib/live-leg";

describe("live-bet", () => {
  it("lost is immediate when any leg lost", () => {
    expect(liveBetView(["won", "lost", "live"]).state).toBe("lost");
    expect(liveBetView(["pending", "lost"]).state).toBe("lost");
  });

  it("won when all active legs won", () => {
    expect(liveBetView(["won", "won"]).state).toBe("won");
    expect(liveBetView(["won", "void"]).state).toBe("won");
  });

  it("live progress excludes void from total", () => {
    const v = liveBetView(["won", "live", "void", "pending"]);
    expect(v.state).toBe("live");
    expect(v.total).toBe(3);
    expect(v.voided).toBe(1);
    expect(v.won).toBe(1);
    expect(v.live).toBe(1);
    expect(activeLegStates(["won", "void", "live"] as LiveLegState[])).toEqual([
      "won",
      "live",
    ]);
  });

  it("pending when no legs started", () => {
    expect(liveBetView(["pending", "pending"]).state).toBe("pending");
  });
});