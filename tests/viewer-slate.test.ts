import { describe, expect, it } from "vitest";
import { buildDataIndex, type DataIndexDateEntry } from "../lib/data-index";
import {
  noGamesTodayMessage,
  resolveViewerSlateSegment,
} from "../lib/viewer-slate";

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

describe("noGamesTodayMessage", () => {
  it("includes next 9pm Sydney publish hint", () => {
    expect(noGamesTodayMessage(new Date("2026-11-26T10:00:00Z"))).toMatch(
      /9pm Sydney/i
    );
  });
});