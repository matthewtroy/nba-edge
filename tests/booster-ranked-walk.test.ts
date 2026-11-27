import { describe, expect, it } from "vitest";
import { buildMultis } from "../lib/multis";
import type { PickLeg } from "../lib/types";

function synthMain(
  i: number,
  gameId: string,
  playerId: string,
  line: number,
  fair: number,
  books: Record<string, number>
): PickLeg {
  const px = books.Sportsbet ?? books.TAB ?? Object.values(books)[0];
  return {
    id: `leg-${i}-${line}`,
    gameId,
    team: `Team${i}`,
    opponent: "Opp",
    playerId,
    playerName: `Player ${i}`,
    headshotUrl: "",
    market: "pts",
    line,
    probability: 0.65,
    fairPrice: fair,
    takeAt: fair * 1.08,
    starter: true,
    starterEligible: true,
    tags: ["Value"],
    reasons: [{ type: "form", text: "7/10 at this line" }],
    confluence: 2,
    signals: { PRICE: { active: true }, FORM: { active: true, label: "L10 65%" } },
    bookiePrices: books,
    bestBookie: books.Sportsbet != null ? "Sportsbet" : "TAB",
    bestPrice: px,
    reasonLine: "7/10 hits at line",
  };
}

describe("Booster ranked bookie walk", () => {
  it("uses next bookie when Sportsbet has no stepped line", () => {
    const picks: PickLeg[] = [
      synthMain(1, "g1", "p1", 20, 1.55, { Sportsbet: 1.7 }),
      synthMain(2, "g1", "p1", 25, 2.05, { TAB: 2.6 }),
      synthMain(3, "g2", "p2", 20, 1.55, { Sportsbet: 1.7, TAB: 1.7 }),
      synthMain(4, "g2", "p2", 25, 2.05, { TAB: 2.6 }),
      synthMain(5, "g3", "p3", 20, 1.55, { Sportsbet: 1.7, TAB: 1.7 }),
      synthMain(6, "g3", "p3", 25, 2.05, { TAB: 2.6 }),
      synthMain(7, "g4", "p4", 20, 1.55, { Sportsbet: 1.7, TAB: 1.7 }),
      synthMain(8, "g4", "p4", 25, 2.05, { TAB: 2.6 }),
    ];
    const { bets, notBuilt } = buildMultis(picks, 8);
    const main = bets.find((b) => b.type === "mainPlay");
    const booster = bets.find((b) => b.type === "booster");
    expect(main?.bestBookie).toBe("Sportsbet");
    expect(booster).toBeDefined();
    expect(booster!.bestBookie).toBe("TAB");
    expect(notBuilt.find((n) => n.type === "booster")).toBeUndefined();
  });

  it("notBuilt reports candidates tried", () => {
    const picks: PickLeg[] = [
      synthMain(1, "g1", "p1", 20, 1.55, { Sportsbet: 1.7 }),
      synthMain(2, "g1", "p1", 25, 2.05, {}),
      synthMain(3, "g2", "p2", 20, 1.55, { Sportsbet: 1.7 }),
      synthMain(4, "g2", "p2", 25, 2.05, {}),
      synthMain(5, "g3", "p3", 20, 1.55, { Sportsbet: 1.7 }),
      synthMain(6, "g3", "p3", 25, 2.05, {}),
      synthMain(7, "g4", "p4", 20, 1.55, { Sportsbet: 1.7 }),
      synthMain(8, "g4", "p4", 25, 2.05, {}),
    ];
    const { bets, notBuilt } = buildMultis(picks, 8);
    expect(bets.find((b) => b.type === "mainPlay")).toBeDefined();
    const nb = notBuilt.find((n) => n.type === "booster");
    expect(nb?.reason).toMatch(/tried/i);
  });
});