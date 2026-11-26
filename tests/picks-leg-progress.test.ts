import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("PicksScreen", () => {
  it("picks list uses row dividers not per-row borders", () => {
    const picks = fs.readFileSync(
      path.join(process.cwd(), "src/screens/PicksScreen.tsx"),
      "utf8"
    );
    const row = fs.readFileSync(
      path.join(process.cwd(), "src/components/PickLegRow.tsx"),
      "utf8"
    );
    expect(picks).toMatch(/divide-y divide-white\/\[0\.04\]/);
    expect(row).not.toMatch(/border-b border-white/);
    expect(row).not.toContain("pick-leg-row-bleed");
    expect(row).toMatch(/px-4/);
  });

  it("wires LegProgress on each pick row", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/screens/PicksScreen.tsx"),
      "utf8"
    );
    expect(src).toContain("PickLegRow");
    const row = fs.readFileSync(
      path.join(process.cwd(), "src/components/PickLegRow.tsx"),
      "utf8"
    );
    expect(row).toContain("LegProgress");
    expect(row).toContain("liveView");
    expect(row).toContain("leg-title-live-dot");
    expect(row).toMatch(/flex items-start[\s\S]*leg-title-live-dot/);
  });

  it("LegProgress uses one right stat+glyph column only", () => {
    const bar = fs.readFileSync(
      path.join(process.cwd(), "src/components/LegProgress.tsx"),
      "utf8"
    );
    expect(bar).toContain('data-testid="leg-progress-right"');
    expect(bar).not.toContain("legProgressPillSymbol");
    expect(bar.match(/leg-progress-right/g)?.length).toBe(1);
    expect(bar).toContain('data-testid="leg-progress-target-tick"');
    expect(bar).not.toContain("leg-progress-target-label");
    expect(bar).not.toMatch(/min-w-\[2\.5rem\]/);
    expect(bar).toMatch(/gap-1 min-w-0/);
    expect(bar).not.toContain("leg-progress-value-track");
    expect(bar).toContain("showTrackPlaceholder");
    expect(bar).toContain("leg-progress-track-placeholder");
    expect(bar).toMatch(/h-\[6px\]/);
    expect(bar).toMatch(/maxWidth.*handlePct/);
  });
});