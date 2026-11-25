import { describe, expect, it } from "vitest";
import { slateMatchupWithTip } from "../lib/team-abbrev";

describe("team abbrev", () => {
  it("formats CLE @ NYK with Sydney tip", () => {
    expect(
      slateMatchupWithTip({
        awayTeam: "Cleveland Cavaliers",
        homeTeam: "New York Knicks",
        startTimeSydney: "11:30 am",
      })
    ).toBe("CLE @ NYK · 11:30 am");
  });
});