import { describe, expect, it } from "vitest";
import {
  OFFICIAL_CARD_BOOKIE,
  shouldLockOfficialCardNow,
  sydneyHour,
} from "../lib/official-card-time";

describe("official card lock", () => {
  it("forces lock with env", () => {
    const prev = process.env.OFFICIAL_CARD_LOCK;
    process.env.OFFICIAL_CARD_LOCK = "1";
    expect(shouldLockOfficialCardNow(new Date("2026-01-15T10:00:00Z"))).toBe(true);
    if (prev === undefined) delete process.env.OFFICIAL_CARD_LOCK;
    else process.env.OFFICIAL_CARD_LOCK = prev;
  });

  it("locks in Sydney evening window", () => {
    const prev = process.env.OFFICIAL_CARD_LOCK;
    delete process.env.OFFICIAL_CARD_LOCK;
  // 10:00 UTC ≈ 21:00 Sydney (AEDT)
    const utc = new Date("2026-01-15T10:00:00Z");
    expect(sydneyHour(utc)).toBeGreaterThanOrEqual(19);
    expect(shouldLockOfficialCardNow(utc)).toBe(true);
    if (prev) process.env.OFFICIAL_CARD_LOCK = prev;
  });

  it("defaults official bookie", () => {
    expect(OFFICIAL_CARD_BOOKIE).toBe("bet365");
  });
});