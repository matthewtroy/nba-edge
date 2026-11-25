import { describe, expect, it } from "vitest";
import type { PickLeg } from "../lib/types";
import { legBookieQuoteView } from "../lib/leg-bookie-quote";

function rebLeg(line: number, price: number, fair: number, p: number): PickLeg {
  return {
    id: `diabate-reb-${line}`,
    playerId: "diabate",
    playerName: "Moussa Diabate",
    gameId: "g1",
    team: "Hornets",
    market: "reb",
    line,
    probability: p,
    fairPrice: fair,
    takeAt: fair * 1.08,
    bookiePrices: { Ladbrokes: price },
    tags: [],
  } as PickLeg;
}

describe("leg bookie quote (Diabate reb line change)", () => {
  const catalog = [
    rebLeg(10, 1.55, 1.72, 0.58),
    rebLeg(13, 2.85, 3.1, 0.32),
  ];

  it("uses exact price on 13+ at bookie", () => {
    const view = legBookieQuoteView(catalog[1], "Ladbrokes", catalog);
    expect(view.offered).toBe(true);
    expect(view.displayPrice).toBe(2.85);
    expect(view.modelLeg.line).toBe(13);
    expect(view.modelLeg.fairPrice).toBe(3.1);
  });

  it("does not reuse 10+ price when 13+ is selected", () => {
    const view = legBookieQuoteView(catalog[1], "Ladbrokes", catalog);
    expect(view.displayPrice).not.toBe(1.55);
  });

  it("nearest rung when exact line missing at bookie", () => {
    const only10 = [rebLeg(10, 1.55, 1.72, 0.58)];
    const target = {
      ...only10[0],
      id: "diabate-reb-13",
      line: 13,
      fairPrice: 3.1,
      probability: 0.32,
      bookiePrices: {},
    };
    const view = legBookieQuoteView(target, "Ladbrokes", only10);
    expect(view.offered).toBe(true);
    expect(view.displayPrice).toBe(1.55);
    expect(view.lineShift).toMatch(/13\+/);
  });

  it("not offered when no quote", () => {
    const target = {
      ...catalog[1],
      bookiePrices: {},
    };
    const view = legBookieQuoteView(target, "Ladbrokes", []);
    expect(view.offered).toBe(false);
  });
});