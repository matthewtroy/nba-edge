import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("Home header cleanup", () => {
  it("Home omits status, odds, bookie, injury alerts, and not-built chrome", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/screens/TodayScreen.tsx"),
      "utf8"
    );
    expect(src).toContain("<DateSwitcher");
    expect(src).not.toMatch(/Locked at tip/);
    expect(src).not.toMatch(/Odds /);
    expect(src).not.toMatch(/Card bookie/);
    expect(src).not.toMatch(/Injury alerts/);
    expect(src).not.toMatch(/NotBuiltSection/);
    expect(src).not.toMatch(/injuryAlertsForCard/);
    expect(src).not.toMatch(/Official ·/);
  });
});