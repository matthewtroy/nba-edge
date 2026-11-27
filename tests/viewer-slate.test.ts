import { describe, expect, it } from "vitest";
import { buildDataIndex, type DataIndexDateEntry } from "../lib/data-index";
import {
  NO_NBA_TODAY_BUILDING_TEASE,
  noGamesTodayMessage,
  mostRecentSlateFolderBeforeViewerToday,
  nextSlateFolderAfterViewerToday,
  resolveViewerSlateSegment,
  viewerLocalDayHasNoSlate,
} from "../lib/viewer-slate";
import { settledSlateTabLabel } from "../lib/slate-tab-labels";
import { shouldShowSlateBuildingScreen } from "../lib/slate-building-mode";

function entry(
  date: string,
  firstTipIso: string,
  overrides: Partial<DataIndexDateEntry> = {}
): DataIndexDateEntry {
  return {
    date,
    status: "draft",
    statusLabel: "Draft",
    gameCount: 4,
    legCount: 50,
    multiCount: 2,
    lastUpdated: "2026-11-26T10:00:00Z",
    firstTipIso,
    ...overrides,
  };
}

describe("resolveViewerSlateSegment", () => {
  const laTip = "2026-11-26T03:00:00Z"; // 25 Nov evening LA, 26 Nov afternoon Sydney
  const sydneyTip = "2026-11-26T09:00:00Z"; // 26 Nov evening Sydney

  it("Sydney viewer 2026-11-26 maps Today to 26 Nov slate all day", () => {
    const now = new Date("2026-11-26T03:00:00Z"); // 26 Nov 2pm Sydney
    const index = buildDataIndex([entry("2026-11-26", sydneyTip)], now);
    const seg = resolveViewerSlateSegment(index, now, "Australia/Sydney");
    expect(seg.viewerTodayYmd).toBe("2026-11-26");
    expect(seg.todayFolder).toBe("2026-11-26");
  });

  it("LA viewer maps the same slate folder to 25 Nov local", () => {
    const index = buildDataIndex([entry("2026-11-26", laTip)], new Date("2026-11-26T04:00:00Z"));
    const now = new Date("2026-11-26T04:00:00Z"); // still 25 Nov in LA
    const seg = resolveViewerSlateSegment(index, now, "America/Los_Angeles");
    expect(seg.viewerTodayYmd).toBe("2026-11-25");
    expect(seg.todayFolder).toBe("2026-11-26");
  });

  it("Tomorrow picks next folder after today", () => {
    const index = buildDataIndex(
      [
        entry("2026-11-26", "2026-11-26T09:00:00Z"),
        entry("2026-11-27", "2026-11-27T09:00:00Z"),
      ],
      new Date("2026-11-26T12:00:00Z")
    );
    const seg = resolveViewerSlateSegment(
      index,
      new Date("2026-11-26T12:00:00Z"),
      "Australia/Sydney"
    );
    expect(seg.todayFolder).toBe("2026-11-26");
    expect(seg.tomorrowFolder).toBe("2026-11-27");
  });
});

describe("no games on viewer local day", () => {
  it("falls back to previous slate folder and next game day", () => {
    const index = buildDataIndex(
      [
        entry("2026-11-26", "2026-11-26T09:00:00Z"),
        entry("2026-11-28", "2026-11-28T09:00:00Z"),
      ],
      new Date("2026-11-27T08:00:00.000Z")
    );
    const tz = "Australia/Sydney";
    const now = new Date("2026-11-27T08:00:00.000Z");
    const seg = resolveViewerSlateSegment(index, now, tz);
    expect(seg.todayFolder).toBe(null);
    expect(seg.previousFolder).toBe("2026-11-26");
    expect(seg.nextAfterViewerToday).toBe("2026-11-28");
    expect(mostRecentSlateFolderBeforeViewerToday(index, seg.viewerTodayYmd, tz)).toBe(
      "2026-11-26"
    );
    expect(nextSlateFolderAfterViewerToday(index, seg.viewerTodayYmd, tz)).toBe(
      "2026-11-28"
    );
    expect(settledSlateTabLabel("2026-11-26", tz)).toMatch(/\(26\/11\)/);
    expect(
      shouldShowSlateBuildingScreen({
        index,
        slateDate: "2026-11-26",
        todayDate: "2026-11-26",
        slateEmpty: false,
        officialCard: {
          lockedAt: "x",
          slateDate: "2026-11-26",
          bookie: "Ladbrokes",
          multis: [],
          notBuilt: [],
          whatChanged: [],
          injuries: [],
        },
        officialInUse: true,
        noGamesToday: true,
      })
    ).toBe(false);
  });
});

describe("noGamesTodayMessage", () => {
  it("includes next 9pm Sydney publish hint", () => {
    expect(noGamesTodayMessage(new Date("2026-11-26T10:00:00Z"))).toMatch(
      /9pm Sydney/i
    );
  });
});

describe("building card No NBA today tease", () => {
  const gapIndex = () =>
    buildDataIndex(
      [
        entry("2026-11-26", "2026-11-26T09:00:00Z"),
        entry("2026-11-28", "2026-11-28T09:00:00Z"),
      ],
      new Date("2026-11-27T08:00:00.000Z")
    );

  it("viewer 2026-11-27 with no local slate → tease copy and flag", () => {
    const tz = "Australia/Sydney";
    const now = new Date("2026-11-27T08:00:00.000Z");
    const index = gapIndex();
    expect(resolveViewerSlateSegment(index, now, tz).viewerTodayYmd).toBe(
      "2026-11-27"
    );
    expect(resolveViewerSlateSegment(index, now, tz).nextAfterViewerToday).toBe(
      "2026-11-28"
    );
    expect(viewerLocalDayHasNoSlate(index, now, tz)).toBe(true);
    expect(NO_NBA_TODAY_BUILDING_TEASE).toBe("No NBA today");
  });

  it("viewer local day with games → no tease flag", () => {
    const tz = "Australia/Sydney";
    const now = new Date("2026-11-26T12:00:00.000Z");
    const index = buildDataIndex(
      [entry("2026-11-26", "2026-11-26T09:00:00Z")],
      now
    );
    expect(viewerLocalDayHasNoSlate(index, now, tz)).toBe(false);
  });
});