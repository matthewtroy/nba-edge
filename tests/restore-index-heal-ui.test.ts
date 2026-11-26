import { describe, expect, it } from "vitest";
import { buildDataIndex, type DataIndexDateEntry } from "../lib/data-index";
import { resolveViewerSlateSegment } from "../lib/viewer-slate";
import { userFacingLoadMessage } from "../lib/data-load-error";

describe("restore-index heal viewer", () => {
  const entry = (date: string): DataIndexDateEntry => ({
    date,
    status: "draft",
    statusLabel: "Draft",
    gameCount: 6,
    legCount: 40,
    multiCount: 3,
    lastUpdated: "2026-11-26T05:00:00.000Z",
    firstTipIso: "2026-11-26T09:00:00.000Z",
  });

  it("4:31pm Sydney 26 Nov shows Today for slate in index", () => {
    const now = new Date("2026-11-26T05:31:00.000Z");
    const index = buildDataIndex([entry("2026-11-26")], now);
    const seg = resolveViewerSlateSegment(index, now, "Australia/Sydney");
    expect(seg.todayFolder).toBe("2026-11-26");
  });

  it("empty index uses Updating copy for branded state", () => {
    expect(userFacingLoadMessage("updating")).toMatch(/Updating slate/i);
  });
});