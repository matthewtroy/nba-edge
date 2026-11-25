import { describe, it, expect } from "vitest";
import { buildWhatChanged } from "../lib/what-changed";
import type { InjuryEntry, PickLeg } from "../lib/types";

describe("buildWhatChanged", () => {
  it("uses full names and stat bump", () => {
    const injuries: InjuryEntry[] = [
      {
        playerId: "1",
        playerName: "Duncan Robinson",
        teamId: "det",
        teamName: "Pistons",
        gameId: "g1",
        status: "Out",
        source: "nba",
        updatedAt: "",
      },
    ];
    const picks: PickLeg[] = [
      {
        id: "a",
        gameId: "g1",
        team: "Pistons",
        opponent: "Magic",
        playerId: "2",
        playerName: "Cade Cunningham",
        headshotUrl: "",
        market: "pts",
        line: 25,
        probability: 0.7,
        fairPrice: 1.5,
        takeAt: 1.62,
        projectedMinutes: 34,
        tags: [],
        reasons: [{ type: "injury", text: "Duncan Robinson out: +3.2 pts" }],
      },
    ];
    expect(buildWhatChanged(injuries, picks)).toEqual([
      "Duncan Robinson out → Cade Cunningham +3.2 pts",
    ]);
  });

  it("skips small bumps", () => {
    const injuries: InjuryEntry[] = [
      {
        playerId: "1",
        playerName: "X Player",
        teamId: "t",
        teamName: "Team",
        gameId: "g",
        status: "Out",
        source: "",
        updatedAt: "",
      },
    ];
    const picks: PickLeg[] = [
      {
        id: "a",
        gameId: "g",
        team: "Team",
        opponent: "O",
        playerId: "2",
        playerName: "Y Star",
        headshotUrl: "",
        market: "pts",
        line: 10,
        probability: 0.6,
        fairPrice: 1.5,
        takeAt: 1.6,
        tags: [],
        reasons: [{ type: "injury", text: "X Player out: +0.8 pts" }],
      },
    ];
    expect(buildWhatChanged(injuries, picks)).toEqual([]);
  });
});