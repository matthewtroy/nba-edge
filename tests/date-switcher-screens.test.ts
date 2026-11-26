import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { buildDataIndex, type DataIndexDateEntry } from "../lib/data-index";
import { resolveViewerSlateSegment } from "../lib/viewer-slate";

const screens = [
  "TodayScreen.tsx",
  "PicksScreen.tsx",
  "GamesScreen.tsx",
  "InjuriesScreen.tsx",
];

describe("DateSwitcher on main tabs", () => {
  it("Today/Picks/Games/Injuries render DateSwitcher", () => {
    for (const file of screens) {
      const src = fs.readFileSync(
        path.join(process.cwd(), "src/screens", file),
        "utf8"
      );
      expect(src).toContain("<DateSwitcher");
    }
  });

  it("Tomorrow tease on main tabs when tomorrow folder empty", () => {
    for (const file of screens) {
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
  });
});