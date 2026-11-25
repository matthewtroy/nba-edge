import { describe, expect, it } from "vitest";
import { buildResultsSlice } from "../lib/results-aggregate";
import { profitUnitsForBet } from "../lib/official-bet-settle";
import type { OfficialBetRow } from "../lib/official-bet-settle";
import type { SettledLegRow } from "../lib/settle-core";
import type { ValueLegRow } from "../lib/value-leg-track";

describe("official bet profit", () => {
  it("won multi uses combined price minus stake", () => {
    expect(profitUnitsForBet("won", 1, 8)).toBe(7);
    expect(profitUnitsForBet("lost", 1, 8)).toBe(-1);
    expect(profitUnitsForBet("void", 1, 8)).toBe(0);
    expect(profitUnitsForBet("won", 1, undefined)).toBeNull();
  });
});

describe("results slice", () => {
  it("aggregates bet record without leg-count ROI", () => {
    const bets: OfficialBetRow[] = [
      {
        slateDate: "2026-01-01",
        betType: "mainPlay",
        label: "Main",
        legIds: ["a"],
        result: "won",
        profitUnits: 6,
        stakeUnits: 1,
        publishedCombinedPrice: 7,
      },
      {
        slateDate: "2026-01-02",
        betType: "mainPlay",
        label: "Main",
        legIds: ["b"],
        result: "lost",
        profitUnits: -1,
        stakeUnits: 1,
      },
    ];
    const slice = buildResultsSlice({
      officialLegs: [] as SettledLegRow[],
      officialBets: bets,
      valueLegRows: [] as ValueLegRow[],
      gradedLegs: [],
      now: new Date("2026-01-03T10:00:00Z"),
    });
    expect(slice.official.record.won).toBe(1);
    expect(slice.official.record.lost).toBe(1);
    expect(slice.official.record.profit).toBe(5);
    expect(slice.official.record.roi).toBeCloseTo(2.5);
  });

  it("value legs stake 1u and void excluded", () => {
    const valueRows: ValueLegRow[] = [
      {
        id: "v1",
        slateDate: "2026-01-01",
        playerName: "A",
        market: "pts",
        line: 20,
        result: "won",
        price: 2,
        bookie: "TAB",
        fairPrice: 1.7,
        edgeVsFair: 0.17,
        probability: 0.6,
      },
      {
        id: "v2",
        slateDate: "2026-01-01",
        playerName: "B",
        market: "reb",
        line: 5,
        result: "lost",
        price: 1.9,
        bookie: "Sportsbet",
        fairPrice: 1.6,
        edgeVsFair: 0.19,
        probability: 0.55,
      },
    ];
    const slice = buildResultsSlice({
      officialLegs: [],
      officialBets: [],
      valueLegRows: valueRows,
      gradedLegs: [],
    });
    expect(slice.valueLegs.record.staked).toBe(2);
    expect(slice.valueLegs.record.profit).toBe(0);
    expect(slice.valueLegs.record.hitRate).toBe(0.5);
  });
});