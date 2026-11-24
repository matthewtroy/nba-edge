import { describe, it, expect } from "vitest";
import { qualifiesMainPlayLeg } from "../lib/multis";
import type { PickLeg } from "../lib/types";

describe("check news exclusion", () => {
  it("excludes Check news from Main Play", () => {
    const leg: PickLeg = {
      id: "1",
      gameId: "g",
      team: "T",
      opponent: "O",
      playerId: "p",
      playerName: "Player",
      headshotUrl: "",
      market: "pts",
      line: 20,
      probability: 0.65,
      fairPrice: 1.5,
      takeAt: 1.62,
      tags: ["Check news"],
      reasons: [],
      starterEligible: true,
    };
    expect(qualifiesMainPlayLeg(leg)).toBe(false);
  });
});