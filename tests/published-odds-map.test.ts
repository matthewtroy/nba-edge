import { describe, expect, it } from "vitest";
import { oddsMapsFromPublished } from "../scripts/fetch-published-data";
import { legOddsLookupKey } from "../lib/odds";

describe("oddsMapsFromPublished", () => {
  it("normalizes cache keys points → pts", () => {
    const { best } = oddsMapsFromPublished([], {
      lastPulled: "2020-01-01T00:00:00.000Z",
      oddsMap: {
        "jayson tatum|points|25": { price: 1.88, bookie: "Sportsbet" },
      },
    });
    expect(best.get(legOddsLookupKey("Jayson Tatum", "pts", 25))).toEqual({
      price: 1.88,
      bookie: "Sportsbet",
    });
  });
});