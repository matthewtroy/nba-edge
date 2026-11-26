import { describe, expect, it } from "vitest";
import { buildShortLegReason, sortLegRowBadgeTags, visibleLegTags } from "../lib/leg-display";
import { legRowBadgeLabels } from "../lib/value-at-bookie";
import type { PickLeg, PlayerGameLog } from "../lib/types";

const base: PickLeg = {
  id: "x",
  gameId: "g",
  team: "T",
  opponent: "O",
  playerId: "p",
  playerName: "Test",
  headshotUrl: "",
  market: "reb",
  line: 5,
  probability: 0.7,
  fairPrice: 1.5,
  takeAt: 1.6,
  tags: [],
  reasons: [{ type: "injury", text: "Allen out → only big left: +3.4 reb" }],
};

function logs(reb: number[]): PlayerGameLog[] {
  return reb.map((r, i) => ({
    gameId: `g${i}`,
    date: "2026-11-20",
    minutes: 30,
    pts: 10,
    reb: r,
    ast: 2,
    threes: 1,
    source: "espn" as const,
  }));
}

describe("legRowBadgeLabels", () => {
  it("dedupes former_team + Former Team + boards shared to one Former Team pill", () => {
    const leg = {
      ...base,
      tags: ["former_team", "Former Team", "boards shared", "Value"],
      blowoutRisk: false,
      fairPrice: 1.5,
      takeAt: 1.4,
      bookiePrices: { Sportsbet: 2.0 },
      bestBookie: "Sportsbet",
      bestPrice: 2.0,
    };
    expect(visibleLegTags(leg.tags)).not.toContain("boards shared");
    const pills = legRowBadgeLabels(leg, "Sportsbet");
    expect(pills.filter((p) => p.toLowerCase() === "former team")).toHaveLength(1);
    expect(pills).not.toContain("boards shared");
    expect(pills).not.toContain("former_team");
  });

  it("never surfaces Check prices on leg row badges", () => {
    const leg = {
      ...base,
      tags: ["Check prices", "Value"],
      fairPrice: 1.5,
      takeAt: 1.4,
      bookiePrices: { Sportsbet: 3.5 },
      bestBookie: "Sportsbet",
      bestPrice: 3.5,
    };
    const pills = legRowBadgeLabels(leg, "Sportsbet");
    expect(pills).not.toContain("Check prices");
    expect(pills).toContain("Value");
  });
});

describe("sortLegRowBadgeTags", () => {
  it("orders Value before High probability before Former team", () => {
    expect(
      sortLegRowBadgeTags(["Roughie", "Former team", "High probability", "Value"])
    ).toEqual(["Value", "High probability", "Former team", "Roughie"]);
  });
});

describe("buildShortLegReason", () => {
  it("prefers injury redistribution over form", () => {
    const line = buildShortLegReason(base, logs([6, 6, 6, 6, 6]));
    expect(line).toMatch(/Allen out/);
  });

  it("uses L10 avg fallback when form below 7/10", () => {
    const leg = { ...base, reasons: [] };
    expect(buildShortLegReason(leg, logs([3, 3, 3, 3, 3, 8, 8, 8, 8, 8]))).toMatch(
      /Avg [\d.]+ reb last 10|5\/5 at this line/
    );
  });

  it("shows form at 7/10", () => {
    const leg = { ...base, reasons: [] };
    expect(buildShortLegReason(leg, logs([8, 8, 8, 8, 8, 8, 8, 3, 3, 3]))).toMatch(
      /7\/10 at this line/
    );
  });
});