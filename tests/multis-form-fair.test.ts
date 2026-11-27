import { describe, expect, it } from "vitest";
import { formTextIsSupportive, formImpliedMinHitRate } from "../lib/leg-reason-supportive";
import { mainPlayHasValueOrHighProb } from "../lib/main-play-eligibility";
import { qualifiesCrossGameSgmLeg } from "../lib/cross-game-sgm-leg";
import type { PickLeg } from "../lib/types";

describe("form vs price", () => {
  it("6/10 at 1.38 is not supportive form", () => {
    const min = formImpliedMinHitRate(1.38);
    expect(min).toBeCloseTo(1 / 1.38, 5);
    expect(formTextIsSupportive("6/10 at this line", 0.72, min)).toBe(false);
    expect(formTextIsSupportive("8/10 at this line", 0.72, min)).toBe(true);
  });
});

describe("edge at bet bookie", () => {
  const base: PickLeg = {
    id: "1",
    gameId: "g",
    team: "T",
    opponent: "O",
    playerId: "p",
    playerName: "P",
    headshotUrl: "",
    market: "pts",
    line: 10,
    probability: 0.8,
    fairPrice: 1.35,
    takeAt: 1.46,
    tags: ["High probability"],
    reasons: [{ type: "form", text: "8/10 at this line" }],
    starterEligible: true,
    bookiePrices: { Ladbrokes: 1.25 },
    bestPrice: 1.25,
    bestBookie: "Ladbrokes",
  };

  it("excludes high prob when bookie price below fair", () => {
    expect(mainPlayHasValueOrHighProb(base, "Ladbrokes")).toBe(false);
    expect(qualifiesCrossGameSgmLeg(base, "Ladbrokes", [base])).toBe(false);
  });

  it("value requires take-at (fair×1.08) at bookie", () => {
    const leg: PickLeg = {
      ...base,
      probability: 0.65,
      tags: ["Value"],
      fairPrice: 1.5,
      takeAt: 1.62,
      bookiePrices: { Ladbrokes: 1.6 },
      bestPrice: 1.6,
    };
    expect(mainPlayHasValueOrHighProb(leg, "Ladbrokes")).toBe(false);
    leg.bookiePrices = { Ladbrokes: 1.63 };
    expect(mainPlayHasValueOrHighProb(leg, "Ladbrokes")).toBe(true);
  });
});