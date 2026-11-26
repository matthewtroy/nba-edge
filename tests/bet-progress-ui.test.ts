import { describe, expect, it } from "vitest";
import { liveBetView } from "../lib/live-bet";
import type { LiveLegState } from "../lib/live-leg";
import type { LiveLegView } from "../lib/live-leg";
import {
  betProgressSegmentClass,
  betProgressShouldShow,
  liveBetLandedLabel,
  liveBetOutcomePill,
  multiCardLiveBorderClass,
} from "../lib/live-leg-ui";
import { legStatesForMulti } from "../lib/live-tracking";
import type { MultiBet } from "../lib/types";

const legView = (state: LiveLegState): LiveLegView => ({
  state,
  line: 20,
  actual: state === "won" ? 22 : null,
  progress: null,
});

describe("bet-progress ui", () => {
  it("landed copy counts won vs active legs (void excluded from total)", () => {
    const view = liveBetView(["won", "won", "live", "void", "pending"]);
    expect(view.total).toBe(4);
    expect(view.won).toBe(2);
    expect(liveBetLandedLabel(view)).toBe("2 of 4 landed");
  });

  it("segment count matches multi leg order", () => {
    const multi: MultiBet = {
      type: "mainPlay",
      legs: ["a", "b", "c", "d", "e"],
      label: "test",
      combinedProbability: 0.1,
      combinedFairPrice: 5,
      combinedTakeAt: 4.5,
      bestBookie: "bet365",
      bestBookieTotal: 5,
      summary: "test",
    };
    const views = new Map<string, LiveLegView>([
      ["a", legView("won")],
      ["b", legView("won")],
      ["c", legView("won")],
      ["d", legView("live")],
      ["e", legView("pending")],
    ]);
    const states = legStatesForMulti(multi, views);
    expect(states).toHaveLength(5);
    expect(states).toEqual(["won", "won", "won", "live", "pending"]);
  });

  it("maps segment classes per leg state", () => {
    expect(betProgressSegmentClass("won")).toMatch(/emerald/);
    expect(betProgressSegmentClass("lost")).toMatch(/red/);
    expect(betProgressSegmentClass("live")).toMatch(/sky/);
    expect(betProgressSegmentClass("void")).toMatch(/white/);
    expect(betProgressSegmentClass("pending")).toMatch(/white\/10/);
  });

  it("shows progress for live/won/lost multis only", () => {
    expect(betProgressShouldShow(liveBetView(["pending", "pending"]))).toBe(false);
    expect(betProgressShouldShow(liveBetView(["won", "live"]))).toBe(true);
    expect(betProgressShouldShow(liveBetView(["won", "lost"]))).toBe(true);
    expect(betProgressShouldShow(liveBetView(["won", "won"]))).toBe(true);
  });

  it("won/lost outcome pills and card border classes", () => {
    expect(liveBetOutcomePill(liveBetView(["won", "won"]))?.label).toBe("✓");
    expect(liveBetOutcomePill(liveBetView(["lost", "won"]))?.label).toBe("✗");
    expect(liveBetOutcomePill(liveBetView(["won", "live"]))).toBeNull();

    expect(multiCardLiveBorderClass(liveBetView(["won", "won"]))).toBe(
      "multi-card-live-won"
    );
    expect(multiCardLiveBorderClass(liveBetView(["lost", "won"]))).toBe(
      "multi-card-live-lost"
    );
    expect(multiCardLiveBorderClass(liveBetView(["won", "live"]))).toBe(
      "multi-card-live-tracking"
    );
    expect(multiCardLiveBorderClass(undefined)).toBe("");
  });
});