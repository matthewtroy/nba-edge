import { describe, it, expect } from "vitest";
import { buildMultis } from "../lib/multis";
import type { PickLeg } from "../lib/types";

describe("multis not built reasons", () => {
  it("reports Main Play when pool too small", () => {
    const picks: PickLeg[] = [
      {
        id: "a",
        gameId: "g1",
        team: "T",
        opponent: "O",
        playerId: "p1",
        playerName: "A",
        headshotUrl: "",
        market: "pts",
        line: 10,
        probability: 0.65,
        fairPrice: 1.54,
        takeAt: 1.66,
        tags: [],
        reasons: [],
        starterEligible: true,
      },
    ];
    const { bets, notBuilt } = buildMultis(picks, 1);
    expect(bets.find((b) => b.type === "mainPlay")).toBeUndefined();
    const main = notBuilt.find((n) => n.type === "mainPlay");
    expect(main?.reason).toMatch(/Only \d legs/);
  });
});