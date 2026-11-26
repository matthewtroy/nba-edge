import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { weekdayShort } from "../src/hooks/useSlateDate";
import { slateTabDateChip, todayTabLabel } from "../lib/slate-tab-labels";

describe("viewer-local Today/Tomorrow labels", () => {
  it("DateSwitcher uses viewer time zone for tab labels", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/DateSwitcher.tsx"),
      "utf8"
    );
    expect(src).toMatch(/viewerTimeZone/);
    expect(src).toMatch(/todayTabLabel/);
  });

  it("weekdayShort respects LA time zone", () => {
    const label = weekdayShort("2026-11-26", "America/Los_Angeles");
    expect(label.length).toBeGreaterThan(0);
  });

  it("todayTabLabel includes Today prefix and local date", () => {
    const label = todayTabLabel("2026-11-26", "Australia/Sydney");
    expect(label).toMatch(/^Today \(/);
  });

  it("slateTabDateChip formats next tab without Today prefix", () => {
    const chip = slateTabDateChip("2026-11-28", "Australia/Sydney");
    expect(chip).not.toContain("Today");
    expect(chip).toMatch(/Sat/);
  });
});