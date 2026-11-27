import { describe, expect, it } from "vitest";
import { RUNGS } from "../lib/pricing";
import { buildMultis } from "../lib/multis";
import { assertOfficialLadderLegs } from "../lib/official-ladder";
import { renderMultiCardText } from "../lib/multi-card-text";
import type { PickLeg } from "../lib/types";

function lineLeg(
  opts: Partial<PickLeg> & Pick<PickLeg, "id" | "gameId" | "playerId" | "playerName" | "market" | "line" | "fairPrice">
): PickLeg {
  const sb = 1.85;
  return {
    team: "T",
    opponent: "O",
    headshotUrl: "",
    probability: 0.72,
    takeAt: opts.fairPrice * 1.08,
    starter: true,
    starterEligible: true,
    tags: ["High probability", "Value"],
    reasons: [{ type: "form", text: "8/10 at this line" }],
    recentTenVsLine: Array(10).fill("hit"),
    bookiePrices: { Sportsbet: sb },
    bestBookie: "Sportsbet",
    bestPrice: sb,
    ...opts,
  };
}

describe("official ladder only", () => {
  it("no non-ladder lines on built multis except Booster stepped rungs", () => {
    const picks: PickLeg[] = [];
    const lines = RUNGS.pts;
    let i = 0;
    for (const line of lines) {
      for (let g = 0; g < 4; g++) {
        i += 1;
        picks.push(
          lineLeg({
            id: `p${g}-pts-${line}`,
            gameId: `g${g}`,
            playerId: `p${g}`,
            playerName: `Player ${g}`,
            market: "pts",
            line,
            fairPrice: line >= 25 ? 2.2 : 1.45,
            bookiePrices: { Sportsbet: line >= 25 ? 2.8 : 1.85 },
            bestPrice: line >= 25 ? 2.8 : 1.85,
          })
        );
      }
    }
    const { bets } = buildMultis(picks, 4);
  const pmap = new Map(picks.map((p) => [p.id, p]));
    if (bets.some((b) => b.type === "booster")) {
      const booster = bets.find((b) => b.type === "booster")!;
      for (const id of booster.legs) {
        const leg = pmap.get(id);
        if (leg && !RUNGS.pts.includes(leg.line)) {
          pmap.set(id, leg);
        }
      }
    }
    const check = assertOfficialLadderLegs(bets, pmap);
    expect(check.offenders).toEqual([]);
    expect(check.ok).toBe(true);
  });

  it("Main Play card proof omits forbidden cross-book copy", () => {
    const picks: PickLeg[] = [
      lineLeg({
        id: "a-pts-15",
        gameId: "g1",
        playerId: "a",
        playerName: "Alpha",
        market: "pts",
        line: 15,
        fairPrice: 1.42,
      }),
      lineLeg({
        id: "b-pts-15",
        gameId: "g2",
        playerId: "b",
        playerName: "Beta",
        market: "pts",
        line: 15,
        fairPrice: 1.42,
      }),
      lineLeg({
        id: "c-pts-15",
        gameId: "g3",
        playerId: "c",
        playerName: "Gamma",
        market: "pts",
        line: 15,
        fairPrice: 1.42,
      }),
      lineLeg({
        id: "d-pts-15",
        gameId: "g4",
        playerId: "d",
        playerName: "Delta",
        market: "pts",
        line: 15,
        fairPrice: 1.42,
      }),
    ];
    const { bets } = buildMultis(picks, 4);
    const main = bets.find((b) => b.type === "mainPlay");
    expect(main).toBeDefined();
    const legs = main!.legs.map((id) => picks.find((p) => p.id === id)!);
    const text = renderMultiCardText(main!, legs);
    expect(text).toMatch(/Main Play/i);
    expect(text.toLowerCase()).not.toMatch(/take at|bet365|cross-book/i);
  });
});