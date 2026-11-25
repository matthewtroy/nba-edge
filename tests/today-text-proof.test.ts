import { describe, expect, it } from "vitest";
import { renderTodayText } from "../lib/today-text";
import { renderMultiCardText } from "../lib/multi-card-text";
import { FORBIDDEN_MULTI_CARD_STRINGS } from "../src/components/MultiCard";
import { loadPublishedSlate } from "./public-data-fixture";
import type { ResultsJson } from "../lib/results-types";

describe("Today proof text", () => {
  it("renders clean layout from public data", () => {
    const { meta, slate, picks, multisRaw } = loadPublishedSlate();
    const text = renderTodayText({
      meta,
      slate,
      multis: multisRaw.bets,
      notBuilt: multisRaw.notBuilt,
      picksById: new Map(picks.map((p) => [p.id, p])),
    });
    expect(text).not.toMatch(/bet365/i);
    expect(text.toLowerCase()).not.toMatch(/take at/);
    expect(text.toLowerCase()).not.toMatch(/best:/);
    const builtMain =
      multisRaw.bets.some(
        (m) =>
          m.type === "mainPlay" &&
          m.bestBookieTotal != null &&
          !!m.bestBookie &&
          m.legs.length > 0
      ) && /  Main Play\n/.test(text);
    const notBuiltMain =
      /Main Play.*No single AU bookie/i.test(text) ||
      text.includes("Not built today");
    expect(builtMain || notBuiltMain).toBe(true);
    expect(text).not.toMatch(/cross-book|Best across books|Best mix/i);
    expect(text).toContain("What changed");
    expect(text).toContain("Audit");

    const withResults: ResultsJson = {
      updatedAt: "2026-11-26T00:00:00Z",
      official: {
        record: { won: 2, lost: 1, void: 0, staked: 3, profit: 0.5, roi: 0.16, bets: 3 },
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
    const withSettle = renderTodayText({
      meta,
      slate,
      multis: multisRaw.bets,
      notBuilt: multisRaw.notBuilt,
      picksById: new Map(picks.map((p) => [p.id, p])),
      results: withResults,
    });
    expect(withSettle).toContain("Official 2–1");
    expect(text).not.toMatch(/~1 in/);
    expect(text).not.toMatch(/\b[123]\+ 3PM\b/i);
    expect(text).not.toMatch(/2\+ 3PM/i);
    expect(text).not.toMatch(/3\+ 3PM/i);
    const smallCount = (text.match(/Small slate/g) ?? []).length;
    expect(smallCount).toBeLessThanOrEqual(1);

    for (const multi of multisRaw.bets) {
      if (multi.bestBookieTotal == null || !multi.bestBookie) continue;
      const legs = multi.legs.map((id) => picks.find((p) => p.id === id)!).filter(Boolean);
      const card = renderMultiCardText(multi, legs);
      for (const bad of FORBIDDEN_MULTI_CARD_STRINGS) {
        expect(card.includes(bad)).toBe(false);
      }
    }
  });
});