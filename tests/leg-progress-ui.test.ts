import { describe, expect, it } from "vitest";
import type { LiveLegView } from "../lib/live-leg";
import {
  legProgressFillClass,
  legProgressFillPercent,
  legProgressMarkerPercent,
  legProgressPillClass,
  liveLegStateLabel,
} from "../lib/live-leg-ui";

const view = (partial: Partial<LiveLegView> & Pick<LiveLegView, "state">): LiveLegView => ({
  line: 20,
  actual: null,
  progress: null,
  ...partial,
});

describe("leg-progress ui", () => {
  it("state labels use won/lost/void not hit/miss", () => {
    expect(liveLegStateLabel(view({ state: "won", actual: 22 }))).toBe("Won");
    expect(liveLegStateLabel(view({ state: "lost", actual: 14 }))).toBe("Lost");
    expect(liveLegStateLabel(view({ state: "void" }))).toBe("Void");
    expect(liveLegStateLabel(view({ state: "live", actual: 12 }))).toBe("Live 12/20");
  });

  it("maps state to pill and fill classes", () => {
    expect(legProgressPillClass(view({ state: "won" }))).toMatch(/emerald/);
    expect(legProgressPillClass(view({ state: "lost" }))).toMatch(/red/);
    expect(legProgressPillClass(view({ state: "live" }))).toMatch(/sky/);
    expect(legProgressFillClass(view({ state: "void" }))).toMatch(/white/);
  });

  it("marker sits at the line (end of track)", () => {
    expect(legProgressMarkerPercent(20)).toBe(100);
    expect(legProgressMarkerPercent(0)).toBe(0);
  });

  it("fill percent reflects progress and caps live below line", () => {
    expect(legProgressFillPercent(view({ state: "won", actual: 24 }))).toBe(100);
    expect(
      legProgressFillPercent(view({ state: "live", actual: 10, progress: 0.5 }))
    ).toBe(50);
    expect(
      legProgressFillPercent(view({ state: "live", actual: 10, progress: null }))
    ).toBe(50);
    expect(
      legProgressFillPercent(view({ state: "lost", actual: 14, progress: null }))
    ).toBe(70);
  });
});