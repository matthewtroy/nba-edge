import { describe, expect, it } from "vitest";
import { defaultDateForIndex, type SlateIndexEntry } from "../lib/data-index";

const entries: SlateIndexEntry[] = [
  { tipDate: "2026-11-24", gameCount: 8 },
  { tipDate: "2026-11-25", gameCount: 2 },
  { tipDate: "2026-11-26", gameCount: 10 },
];

describe("slate data index", () => {
  it("prefers today's tip date when listed", () => {
    const now = new Date("2026-11-25T08:00:00Z");
    expect(defaultDateForIndex(entries, now)).toBe("2026-11-25");
  });

  it("falls forward to next slate", () => {
    const now = new Date("2026-11-25T14:00:00Z");
    expect(
      defaultDateForIndex(
        entries.filter((e) => e.tipDate !== "2026-11-25"),
        now
      )
    ).toBe("2026-11-26");
  });
});