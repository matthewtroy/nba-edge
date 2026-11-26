import { describe, expect, it } from "vitest";
import { formatHomeSettleSummary } from "../lib/home-settle-summary";
import type { ResultsJson } from "../lib/results-types";

function stubResults(overrides: Partial<ResultsJson["official"]["record"]> = {}): ResultsJson {
  return {
    updatedAt: "2026-11-26T00:00:00Z",
    official: {
      record: {
        won: 3,
        lost: 2,
        void: 0,
        staked: 5,
        profit: 1.5,
        roi: 0.3,
        bets: 5,
        ...overrides,
      },
      byBetType: {},
      last14d: [],
      bets: [],
      legs: [],
    },
    valueLegs: {
      record: {
        won: 0,
        lost: 0,
        void: 0,
        staked: 0,
        profit: 0,
        roi: null,
        legs: 0,
        hitRate: null,
        avgPrice: null,
        beatMarket: null,
      },
      byMarket: {},
      byEdgeBand: {},
      legs: [],
    },
    model: { calibration: [], brierLive: null, brierShadow: null, tagHitRates: {} },
    gradedLegs: [],
  };
}

describe("home settle summary", () => {
  it("formats official W-L row", () => {
    expect(formatHomeSettleSummary(stubResults())).toMatch(
      /Official 3–2 · \+1\.50u net · strike 60% · ROI 30%/
    );
  });

  it("returns null when no settled bets", () => {
    expect(formatHomeSettleSummary(stubResults({ bets: 0 }))).toBeNull();
    expect(formatHomeSettleSummary(null)).toBeNull();
  });
});