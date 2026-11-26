import { describe, expect, it } from "vitest";
import {
  espnCacheShrinkBlocked,
  historyEntryCount,
  persistJsonShrinkReason,
  recordKeyCount,
} from "../lib/espn-cache-guard";
import type { HistoryJson } from "../lib/types";

describe("espnCacheShrinkBlocked", () => {
  it("allows growth and small shrink", () => {
    expect(espnCacheShrinkBlocked(100, 120)).toBe(false);
    expect(espnCacheShrinkBlocked(100, 85)).toBe(false);
    expect(espnCacheShrinkBlocked(100, 80)).toBe(false);
  });

  it("blocks empty wipe and >20% loss", () => {
    expect(espnCacheShrinkBlocked(100, 0)).toBe(true);
    expect(espnCacheShrinkBlocked(100, 79)).toBe(true);
    expect(espnCacheShrinkBlocked(50, 30)).toBe(true);
  });

  it("allows cold start", () => {
    expect(espnCacheShrinkBlocked(0, 0)).toBe(false);
    expect(espnCacheShrinkBlocked(0, 10)).toBe(false);
  });
});

describe("recordKeyCount", () => {
  it("counts object keys", () => {
    expect(recordKeyCount({ a: 1, b: 2 })).toBe(2);
    expect(recordKeyCount(null)).toBe(0);
  });
});

describe("persistJsonShrinkReason", () => {
  it("allows partial shrink post-tip", () => {
    expect(persistJsonShrinkReason("h2h", 100, 40, { postTipOff: true })).toBeNull();
  });
});

describe("historyEntryCount", () => {
  it("sums legs and multis", () => {
    const h: HistoryJson = {
      legs: [{ id: "1", date: "d", probability: 0.5 }],
      multis: [],
      calibration: [],
    };
    expect(historyEntryCount(h)).toBe(1);
  });
});