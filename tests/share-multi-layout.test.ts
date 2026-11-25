import { describe, expect, it } from "vitest";
import type { MultiBet, PickLeg } from "../lib/types";
import {
  SHARE_BETSLIP_DPR,
  SHARE_BETSLIP_WIDTH_PX,
  buildShareBetslipLayout,
  shareBetslipHeightPx,
  shareMultiCanvasSize,
} from "../lib/share-betslip-layout";

function stubLegs(n: number): PickLeg[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `leg-${i}`,
    playerId: `p${i}`,
    playerName: `Player ${i + 1}`,
    headshotUrl: "",
    gameId: i < 3 ? "g1" : "g2",
    team: "AAA",
    opponent: "BBB",
    market: "pts",
    line: 20,
    probability: 0.6,
    fairPrice: 1.7,
    takeAt: 1.85,
    tags: [],
    reasons: [],
    starterEligible: true,
  }));
}

function stubMulti(n: number, type: MultiBet["type"] = "mainPlay"): MultiBet {
  const legs = stubLegs(n);
  return {
    type,
    label: `Test ${n}-leg`,
    legs: legs.map((l) => l.id),
    combinedProbability: 0.2,
    combinedFairPrice: 5,
    combinedTakeAt: 5.5,
    bestBookie: "Sportsbet",
    bestBookieTotal: 4.2,
  };
}

describe("share multi image layout", () => {
  it("sizes 1, 5, and 17 leg cards at 540 logical px (1080 @ DPR 2)", () => {
    for (const n of [1, 5, 17]) {
      const size = shareMultiCanvasSize(n);
      expect(size.width).toBe(SHARE_BETSLIP_WIDTH_PX);
      expect(size.width * SHARE_BETSLIP_DPR).toBe(1080);
      expect(size.height).toBe(shareBetslipHeightPx(n, 1));
      if (n > 1) {
        expect(size.height).toBeGreaterThan(shareBetslipHeightPx(1, 1));
      }
    }
    expect(shareMultiCanvasSize(17).height).toBeGreaterThan(shareMultiCanvasSize(5).height);
  });

  it("includes fair line and settle marks on leg blocks", () => {
    const legs = stubLegs(2).map((l, i) => ({
      ...l,
      result: i === 0 ? ("won" as const) : ("lost" as const),
    }));
    const layout = buildShareBetslipLayout({
      multi: stubMulti(2),
      legs,
      bookie: "TAB",
      total: 4.2,
    });
    expect(layout.groups[0].legs[0].fairText).toMatch(/^Fair /);
    expect(layout.groups[0].legs[0].initials).toBeTruthy();
    expect(layout.groups[0].legs[0].settleMark).toBe("won");
    expect(layout.groups[0].legs[1].settleMark).toBe("lost");
  });

  it("builds grouped leg blocks for cross-game SGM", () => {
    const layout = buildShareBetslipLayout({
      multi: stubMulti(5, "crossGameSgm"),
      legs: stubLegs(5),
      bookie: "TAB",
      total: 12.5,
    });
    expect(layout.legCount).toBe(5);
    expect(layout.groups.length).toBeGreaterThan(1);
    expect(layout.groups[0].legs.length).toBeGreaterThan(0);
    expect(layout.dpr).toBe(2);
  });
});