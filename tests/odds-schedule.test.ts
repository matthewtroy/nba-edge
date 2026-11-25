import { describe, expect, it } from "vitest";
import { shouldPullOddsNow, type OddsCacheFile } from "../scripts/odds-schedule";

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

  it("pulls on Sydney evening before official published", () => {
    // 21:15 Sydney AEDT ≈ 10:15 UTC
    const now = new Date("2026-01-15T10:15:00Z");
    expect(shouldPullOddsNow(now, slate, emptyCache, { officialPublishedToday: false })).toBe(
      true
    );
  });

  it("skips evening pull after official published", () => {
    const now = new Date("2026-01-15T10:15:00Z");
    expect(shouldPullOddsNow(now, slate, emptyCache, { officialPublishedToday: true })).toBe(
      false
    );
  });

  it("pulls at 07:00 Sydney", () => {
    const now = new Date("2026-01-14T20:15:00Z"); // 07:15 Sydney Jan 15
    expect(shouldPullOddsNow(now, slate, emptyCache)).toBe(true);
  });
});