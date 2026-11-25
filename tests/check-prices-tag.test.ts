import { describe, expect, it } from "vitest";
import type { PickLeg } from "../lib/types";
import { displayTagsForBookie } from "../lib/value-at-bookie";

describe("Check prices tag", () => {
  it("flags when bookie price exceeds 1.6× fair", () => {
    const leg: PickLeg = {
      id: "1",
      gameId: "g",
      team: "T",
      opponent: "O",
      playerId: "p",
      playerName: "Star",
      headshotUrl: "",
      market: "pts",
      line: 25,
      probability: 0.5,
      fairPrice: 2,
      takeAt: 2.2,
      bookiePrices: { Sportsbet: 3.5 },
      tags: [],
      reasons: [],
    };
    const tags = displayTagsForBookie(leg, "Sportsbet");
    expect(tags).toContain("Check prices");
  });
});