/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import type { PickLeg } from "../lib/types";
import {
  VALUE_SINGLE_MIN_EDGE,
  freezeValueSingles,
  isValueSingle,
  valueLegRowsFromSingles,
} from "../lib/value-leg-track";
import { valueSinglesForSlate } from "../lib/value-singles-source";
import { buildResultsSlice } from "../lib/results-aggregate";
import type { GradedProjectionLeg } from "../lib/graded-leg";

interface ValueSinglesFixture {
  commit: string;
  slateDate: string;
  legCount: number;
  picks: PickLeg[];
}

const valueFx = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "tests/fixtures/value-singles/2026-11-26-81fb442.json"),
    "utf8"
  )
) as ValueSinglesFixture;

function leg(over: Partial<PickLeg>): PickLeg {
  return {
    id: "p1-pts-20",
    playerId: "p1",
    playerName: "P One",
    gameId: "g1",
    market: "pts",
    line: 20,
    fairPrice: 2,
    probability: 0.5,
    bookiePrices: {},
    ...over,
  } as PickLeg;
}

function graded(id: string, result: GradedProjectionLeg["result"]): GradedProjectionLeg {
  return {
    id,
    slateDate: "2026-11-26",
    playerId: "p",
    playerName: "P",
    gameId: "g1",
    market: "pts",
    line: 20,
    result,
    actualValue: null,
    probability: 0.5,
    fairPrice: 2,
    tags: [],
  };
}

describe("item 1: Singles = Value rule at the publish freeze", () => {
  it("needs best AU price ≥ fair × 1.08, excluding bet365 and Q1", () => {
    expect(VALUE_SINGLE_MIN_EDGE).toBe(1.08);
    expect(isValueSingle(leg({ bookiePrices: { Sportsbet: 2.16 } }))).toBe(true);
    expect(isValueSingle(leg({ bookiePrices: { Sportsbet: 2.15 } }))).toBe(false);
    expect(isValueSingle(leg({ bookiePrices: { bet365: 3 } }))).toBe(false);
    expect(isValueSingle(leg({ bookiePrices: { bet365: 3, TAB: 2.1 } }))).toBe(false);
    expect(isValueSingle(leg({ market: "q1pts", bookiePrices: { TAB: 5 } }))).toBe(false);
  });

  it("keeps one single per player/market/line at the best AU price", () => {
    const singles = freezeValueSingles([
      leg({ bookiePrices: { TAB: 2.2, Neds: 2.5, bet365: 4 } }),
      leg({ bookiePrices: { TAB: 3 } }),
    ]);
    expect(singles).toHaveLength(1);
    expect(singles[0]).toMatchObject({ price: 2.5, bookie: "Neds", fairPrice: 2 });
  });

  it("card publish freeze wins; else the pinned pre-tip commit; else picks on disk", () => {
    const current = [leg({ bookiePrices: { TAB: 2.5 } })];
    const preTip = [leg({ id: "p2-pts-20", playerId: "p2", bookiePrices: { TAB: 2.5 } })];
    const cardSingles = freezeValueSingles([leg({ id: "p3-pts-20", playerId: "p3", bookiePrices: { TAB: 9 } })]);
    const load = (c: string) => (c === "abc1234" ? preTip : null);
    const meta = { reasonsFrozenFrom: { commit: "abc1234", committedAt: "", firstTipAt: "" } };

    const fromCard = valueSinglesForSlate({ card: { valueSingles: cardSingles }, meta, currentPicks: current, loadPicksAtCommit: load });
    expect(fromCard.source.kind).toBe("card");
    expect(fromCard.singles.map((s) => s.id)).toEqual(["p3-pts-20"]);

    const fromPreTip = valueSinglesForSlate({ card: {}, meta, currentPicks: current, loadPicksAtCommit: load });
    expect(fromPreTip.source).toEqual({ kind: "preTip", commit: "abc1234" });
    expect(fromPreTip.singles.map((s) => s.id)).toEqual(["p2-pts-20"]);

    const fromDisk = valueSinglesForSlate({ card: null, meta: null, currentPicks: current, loadPicksAtCommit: load });
    expect(fromDisk.source.kind).toBe("currentPicks");
    expect(fromDisk.singles.map((s) => s.id)).toEqual(["p1-pts-20"]);
  });

  it("settles 1u each at the frozen price; void/pending are not counted", () => {
    const singles = freezeValueSingles([
      leg({ id: "a", playerId: "a", bookiePrices: { TAB: 2.5 } }),
      leg({ id: "b", playerId: "b", bookiePrices: { TAB: 3 } }),
      leg({ id: "c", playerId: "c", bookiePrices: { TAB: 3 } }),
    ]);
    const rows = valueLegRowsFromSingles("2026-11-26", singles, [
      graded("a", "won"),
      graded("b", "lost"),
      graded("c", "pending"),
    ]);
    const slice = buildResultsSlice({ officialLegs: [], officialBets: [], valueLegRows: rows, gradedLegs: [] });
    expect(slice.valueLegs.record).toMatchObject({ legs: 2, won: 1, lost: 1, staked: 2, profit: 0.5 });
  });

  it("26 Nov frozen pre-tip copy (81fb442) yields 323 singles", () => {
    const singles = freezeValueSingles(valueFx.picks);
    expect(valueFx.commit.startsWith("81fb442")).toBe(true);
    expect(singles).toHaveLength(323);
    expect(singles.every((s) => s.bookie !== "bet365" && !s.market.startsWith("q1"))).toBe(true);
    expect(singles.every((s) => s.price >= s.fairPrice * 1.08)).toBe(true);
    expect(new Set(singles.map((s) => `${s.playerId}:${s.market}:${s.line}`)).size).toBe(323);
  });
});
