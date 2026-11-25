import { describe, expect, it } from "vitest";
import {
  detectOddsPullTrigger,
  shouldPullOddsNow,
  type OddsCacheFile,
} from "../scripts/odds-schedule";

const slate = [
  {
    id: "g1",
    startTime: "2026-11-25T22:00:00Z",
    startTimeSydney: "9:00 am",
    homeTeam: "H",
    awayTeam: "A",
    homeTeamId: "1",
    awayTeamId: "2",
    homeB2B: false,
    awayB2B: false,
    status: "pre",
  },
];

describe("shouldPullOddsNow", () => {
  const emptyCache: OddsCacheFile = { pullSlotsToday: [] };

  it("pulls at scheduled 9pm Sydney", () => {
    const now = new Date("2026-01-15T10:15:00Z");
    expect(shouldPullOddsNow(now, slate, emptyCache)).toBe(true);
    expect(detectOddsPullTrigger(now, slate, emptyCache)).toBe("scheduled_9pm");
  });

  it("does not pull at 07:00 Sydney anymore", () => {
    const now = new Date("2026-01-14T20:15:00Z");
    expect(shouldPullOddsNow(now, slate, emptyCache)).toBe(false);
  });

  it("pretip when enabled ~2h before tip", () => {
    const tipSoon = [{ ...slate[0], startTime: "2026-01-15T09:00:00Z" }];
    const now = new Date("2026-01-15T07:30:00Z");
    expect(
      detectOddsPullTrigger(now, tipSoon, emptyCache, { pretipPull: true })
    ).toBe("pretip");
  });
});