import { describe, expect, it } from "vitest";
import { dedupeOddsPriceRows, type OddsPriceRow } from "../scripts/supabase-sync";

describe("dedupeOddsPriceRows", () => {
  it("keeps highest decimal price per pull/player/market/line/bookie", () => {
    const base: Omit<OddsPriceRow, "price"> = {
      pull_id: "pull-1",
      player_id: "123",
      game_id: "g1",
      market: "player_points",
      line: 10,
      bookie: "Sportsbet",
    };
    const rows: OddsPriceRow[] = [
      { ...base, price: 1.85 },
      { ...base, price: 1.92 },
      { ...base, price: 1.88 },
    ];
    const out = dedupeOddsPriceRows(rows);
    expect(out).toHaveLength(1);
    expect(out[0].price).toBe(1.92);
  });

  it("does not merge rows with different bookies", () => {
    const rows: OddsPriceRow[] = [
      {
        pull_id: "p",
        player_id: "1",
        game_id: "g",
        market: "player_points",
        line: 5,
        bookie: "TAB",
        price: 2.0,
      },
      {
        pull_id: "p",
        player_id: "1",
        game_id: "g",
        market: "player_points",
        line: 5,
        bookie: "Sportsbet",
        price: 2.1,
      },
    ];
    expect(dedupeOddsPriceRows(rows)).toHaveLength(2);
  });
});