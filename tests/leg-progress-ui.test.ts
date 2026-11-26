import { describe, expect, it } from "vitest";
import type { LiveLegView } from "../lib/live-leg";
import {
  legProgressFillClass,
  legProgressFillPercent,
  legProgressMarkerPercent,
  legProgressPillClass,
  legProgressPillSymbol,
  legProgressRightClass,
  legProgressRightLabel,
  legProgressValueTrackClass,
  legRowLiveTrackingClass,
  legTitleShowsLiveDot,
  liveLegStateLabel,
} from "../lib/live-leg-ui";

const view = (partial: Partial<LiveLegView> & Pick<LiveLegView, "state">): LiveLegView => ({
  line: 20,
  actual: null,
  progress: null,
  ...partial,
});

describe("leg-progress ui", () => {
  it("right labels use N ✓/✗ — not Won/Lost/Hit words", () => {
    expect(legProgressRightLabel(view({ state: "won", actual: 22 }))).toBe("22 ✓");
    expect(legProgressRightLabel(view({ state: "lost", actual: 14 }))).toBe("14 ✗");
    expect(legProgressRightLabel(view({ state: "void" }))).toBe("—");
    expect(legProgressRightLabel(view({ state: "live", actual: 12 }))).toBe("12");
    expect(liveLegStateLabel(view({ state: "won", actual: 22 }))).toBe("22 ✓");
    expect(liveLegStateLabel(view({ state: "lost", actual: 14 }))).toBe("14 ✗");
    expect(liveLegStateLabel(view({ state: "live", actual: 12 }))).toBe("12/20");
  });

  it("live dot only while leg is live", () => {
    expect(legTitleShowsLiveDot(view({ state: "live", actual: 5 }))).toBe(true);
    expect(legTitleShowsLiveDot(view({ state: "won", actual: 22 }))).toBe(false);
    expect(legTitleShowsLiveDot(undefined)).toBe(false);
  });

  it("settled legs use one right label with final stat + glyph", () => {
    expect(legProgressRightLabel(view({ state: "won", actual: 22 }))).toBe("22 ✓");
    expect(legProgressRightLabel(view({ state: "lost", actual: 14 }))).toBe("14 ✗");
    expect(legProgressPillSymbol(view({ state: "won" }))).toBe("✓");
    expect(legProgressPillSymbol(view({ state: "lost" }))).toBe("✗");
  });

  it("maps state to pill, fill, right, and row gradient classes", () => {
    expect(legProgressPillClass(view({ state: "won" }))).toMatch(/emerald/);
    expect(legProgressPillClass(view({ state: "lost" }))).toMatch(/red/);
    expect(legProgressPillClass(view({ state: "live" }))).toMatch(/sky/);
    expect(legProgressFillClass(view({ state: "void" }))).toMatch(/white/);
    expect(legProgressRightClass(view({ state: "won" }))).toMatch(/emerald/);
    expect(legRowLiveTrackingClass(view({ state: "won" }))).toBe("leg-row-live-won");
    expect(legRowLiveTrackingClass(view({ state: "lost" }))).toBe("leg-row-live-lost");
    expect(legRowLiveTrackingClass(view({ state: "live" }))).toBe("");
    expect(legProgressValueTrackClass(true)).toBe("leg-progress-value-track");
    expect(legProgressValueTrackClass(false)).toBe("");
  });

  it("marker sits at the line (end of track)", () => {
    expect(legProgressMarkerPercent(20)).toBe(100);
    expect(legProgressMarkerPercent(0)).toBe(0);
  });

  it("fill is value÷target — 12/20=60%, 28/20=100% when won, 0, live", () => {
    expect(legProgressFillPercent(view({ state: "lost", actual: 12, line: 20 }))).toBe(60);
    expect(legProgressFillPercent(view({ state: "won", actual: 28, line: 20 }))).toBe(100);
    expect(legProgressFillPercent(view({ state: "live", actual: 0, line: 20 }))).toBe(0);
    expect(legProgressFillPercent(view({ state: "live", actual: 12, line: 20 }))).toBe(60);
    expect(
      legProgressFillPercent(view({ state: "live", actual: 10, progress: 0.5, line: 20 }))
    ).toBe(50);
    expect(legProgressFillPercent(view({ state: "lost", actual: 14, line: 20 }))).toBe(70);
  });
});