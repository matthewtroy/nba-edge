import { describe, expect, it } from "vitest";
import { gameStartTimeSydney, toSydney } from "../lib/sydney";
import { slateMatchupWithTip } from "../lib/team-abbrev";

describe("gameStartTimeSydney", () => {
  it("derives exact minute from startTime when startTimeSydney is stale (Heat @ 76ers 2026-11-26)", () => {
    const iso = "2026-11-25T22:10:00Z";
    expect(toSydney(iso)).toBe("9:10 am");
    expect(
      gameStartTimeSydney({
        startTime: iso,
        startTimeSydney: "9:00 am",
      })
    ).toBe("9:10 am");
    expect(
      slateMatchupWithTip({
        awayTeam: "Miami Heat",
        homeTeam: "Philadelphia 76ers",
        startTime: iso,
        startTimeSydney: "9:00 am",
      })
    ).toBe("MIA @ PHI · 9:10 am");
  });

  it("matches fixture slate when ISO is 22:00Z", () => {
    expect(
      gameStartTimeSydney({
        startTime: "2026-11-25T22:00Z",
        startTimeSydney: "9:00 am",
      })
    ).toBe("9:00 am");
  });

  it("Heat @ PHI 401909317 fixture uses ESPN 22:10Z tip", () => {
    const iso = "2026-11-25T22:10:00Z";
    expect(toSydney(iso)).toBe("9:10 am");
    expect(
      slateMatchupWithTip({
        id: "401909317",
        awayTeam: "Miami Heat",
        homeTeam: "Philadelphia 76ers",
        startTime: iso,
        startTimeSydney: "9:00 am",
      })
    ).toBe("MIA @ PHI · 9:10 am");
  });
});