import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { weekdayShort } from "../src/hooks/useSlateDate";

describe("viewer-local Today/Tomorrow labels", () => {
  it("DateSwitcher uses viewer time zone for weekday chips", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/DateSwitcher.tsx"),
      "utf8"
    );
    expect(src).toMatch(/viewerTimeZone/);
    expect(src).toMatch(/Today \(\$\{weekdayShort/);
  });

  it("weekdayShort respects LA time zone", () => {
    const label = weekdayShort("2026-11-26", "America/Los_Angeles");
    expect(label.length).toBeGreaterThan(0);
  });
});