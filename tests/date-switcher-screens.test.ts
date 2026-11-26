import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { buildDataIndex, type DataIndexDateEntry } from "../lib/data-index";
import { resolveViewerSlateSegment } from "../lib/viewer-slate";
import { todayTabLabel, slateTabDateChip } from "../lib/slate-tab-labels";

const screensWithSwitcher = [
  "TodayScreen.tsx",
  "PicksScreen.tsx",
  "GamesScreen.tsx",
];

describe("DateSwitcher", () => {
  it("labels Today + next slate with weekday and calendar date", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/DateSwitcher.tsx"),
      "utf8"
    );
    expect(src).toContain("todayTabLabel");
    expect(src).toContain("nextSlateTabLabel");
    expect(src).not.toContain("Tomorrow (");
  });
});

describe("DateSwitcher on main tabs", () => {
  it("Today/Picks/Games render DateSwitcher; Injuries is standalone", () => {
    const inj = fs.readFileSync(
      path.join(process.cwd(), "src/screens/InjuriesScreen.tsx"),
      "utf8"
    );
    expect(inj).not.toContain("<DateSwitcher");
    for (const file of screensWithSwitcher) {
      const src = fs.readFileSync(
        path.join(process.cwd(), "src/screens", file),
        "utf8"
      );
      expect(src).toContain("<DateSwitcher");
      expect(src).toContain("nextSlateDate=");
    }
  });

  it("Tomorrow tease on dated tabs when tomorrow folder empty", () => {
    for (const file of screensWithSwitcher) {
      const src = fs.readFileSync(
        path.join(process.cwd(), "src/screens", file),
        "utf8"
      );
      expect(src).toContain("TomorrowSlateTease");
    }
  });
});

describe("viewer slate 2-day gap", () => {
  const entry = (date: string, tip: string): DataIndexDateEntry => ({
    date,
    status: "draft",
    statusLabel: "Draft",
    gameCount: 4,
    legCount: 10,
    multiCount: 2,
    lastUpdated: "2026-11-26T05:00:00.000Z",
    firstTipIso: tip,
  });

  it("Tomorrow folder jumps 2026-11-28 when 2026-11-27 missing", () => {
    const now = new Date("2026-11-26T05:46:00.000Z");
    const index = buildDataIndex(
      [
        entry("2026-11-26", "2026-11-26T09:00:00.000Z"),
        entry("2026-11-28", "2026-11-28T09:00:00.000Z"),
      ],
      now
    );
    const seg = resolveViewerSlateSegment(index, now, "Australia/Sydney");
    expect(seg.todayFolder).toBe("2026-11-26");
    expect(seg.tomorrowFolder).toBe("2026-11-28");
    expect(todayTabLabel(seg.viewerTodayYmd, "Australia/Sydney")).toContain("Today");
    expect(slateTabDateChip("2026-11-28", "Australia/Sydney")).toMatch(/Sat/);
  });
});