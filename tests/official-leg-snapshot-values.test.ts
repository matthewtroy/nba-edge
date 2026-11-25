import { describe, expect, it } from "vitest";
import type { MultiBet, PickLeg } from "../lib/types";
import { freezeOfficialLegSnapshots, picksByIdFromOfficialSnapshots } from "../lib/official-leg-snapshot";

function pick(id: string): PickLeg {
  return {
    id,
    gameId: "g1",
    team: "A",
    opponent: "B",
    playerId: "p1",
    playerName: "Test",
    headshotUrl: "",
    market: "pts",
    line: 20,
    probability: 0.6,
    fairPrice: 1.7,
    takeAt: 1.85,
    tags: [],
    reasons: [],
    starterEligible: true,
    recentTenVsLine: ["hit", "miss", "hit"],
    lastTenStatValues: [22, 18, 25, 19, 21, 20, 17, 24, 23, 16],
  };
}

describe("official leg snapshot values", () => {
  it("first open on snapshot leg without values uses live lastTenStatValues", () => {
    const live = pick("leg-1");
    const multi: MultiBet = {
      type: "mainPlay",
      label: "Main",
      legs: ["leg-1"],
      combinedProbability: 0.6,
      combinedFairPrice: 1.7,
      combinedTakeAt: 1.85,
      bestBookie: "TAB",
    };
    const legNoVals = { ...pick("leg-1") };
    delete legNoVals.lastTenStatValues;
    const snaps = freezeOfficialLegSnapshots(
      [multi],
      new Map([["leg-1", legNoVals]]),
      [legNoVals]
    );
    expect(snaps["leg-1"].lastTenStatValues).toBeUndefined();

    const map = picksByIdFromOfficialSnapshots(snaps, [live]);
    const merged = map.get("leg-1");
    expect(merged?.lastTenStatValues).toEqual(live.lastTenStatValues);
    expect(merged?.recentTenVsLine).toEqual(live.recentTenVsLine);
  });
});