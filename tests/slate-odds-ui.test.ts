import { describe, expect, it } from "vitest";
import { slateHasFeedOdds, slateOddsAvailabilityNote } from "../lib/slate-odds-ui";
import type { MetaJson, PickLeg } from "../lib/types";

const baseLeg: PickLeg = {
  id: "a",
  gameId: "g",
  team: "T",
  opponent: "O",
  playerId: "p",
  playerName: "Player",
  headshotUrl: "",
  market: "pts",
  line: 20,
  probability: 0.6,
  fairPrice: 1.6,
  takeAt: 1.73,
  tags: [],
  reasons: [],
};

describe("slate odds ui", () => {
  it("detects feed odds", () => {
    const withOdds = { ...baseLeg, bookiePrices: { Sportsbet: 2.1 } };
    expect(slateHasFeedOdds([baseLeg])).toBe(false);
    expect(slateHasFeedOdds([withOdds])).toBe(true);
  });

  it("shows evening note on draft slates without odds", () => {
    const meta = { slatePublicationStatus: "draft" } as MetaJson;
    expect(slateOddsAvailabilityNote(meta, [baseLeg])).toBe("Prices from 9pm");
  });
});