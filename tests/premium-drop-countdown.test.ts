import { describe, expect, it } from "vitest";
import {
  dropCountdownParts,
  formatCountdownClock,
} from "../lib/premium-drop-countdown";

describe("premium drop countdown", () => {
  it("counts down to next publish in viewer TZ", () => {
    const now = new Date("2026-11-26T05:15:00.000Z");
    const next = "2026-11-26T10:00:00.000Z";
    const parts = dropCountdownParts(next, now, "Australia/Sydney");
    expect(parts.done).toBe(false);
    expect(formatCountdownClock(parts)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(parts.dropLine).toMatch(/Drops /);
    expect(parts.tease).toMatch(/Official card/i);
  });

  it("marks done at publish time", () => {
    const now = new Date("2026-11-26T10:05:00.000Z");
    const parts = dropCountdownParts("2026-11-26T10:00:00.000Z", now, "America/Los_Angeles");
    expect(parts.done).toBe(true);
  });
});