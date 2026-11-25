import { describe, expect, it } from "vitest";
import { buildDataIndex, defaultSlateDate, type DataIndexDateEntry } from "../lib/data-index";

function entry(date: string, status: DataIndexDateEntry["status"] = "draft"): DataIndexDateEntry {
  return {
    date,
    status,
    statusLabel: "Draft",
    gameCount: 8,
    legCount: 100,
    multiCount: 3,
    lastUpdated: "2026-11-25T08:00:00Z",
  };
}

describe("data index", () => {
  it("defaultDate stays on today while games open", () => {
    const now = new Date("2026-11-25T08:00:00Z");
    const index = buildDataIndex([entry("2026-11-25"), entry("2026-11-26")], now);
    expect(defaultSlateDate(index, now)).toBe("2026-11-25");
  });

  it("defaultDate moves to tomorrow when today locked at tip", () => {
    const now = new Date("2026-11-25T14:00:00Z");
    const index = buildDataIndex(
      [entry("2026-11-25", "locked_at_tip"), entry("2026-11-26")],
      now
    );
    expect(defaultSlateDate(index, now)).toBe("2026-11-26");
  });
});