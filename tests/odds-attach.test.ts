import { describe, it, expect } from "vitest";
import { extractOddsBundles } from "../scripts/fetch/odds-events";
import { runModelFromFixture } from "../scripts/run-model";
import { countPricedLegsByMarket } from "../lib/odds-attach";
import path from "path";

describe("odds attach", () => {
  it("maps player_points to pts rung", () => {
    const events = [
      {
        bookmakers: [
          {
            title: "Sportsbet",
            markets: [
              {
                key: "player_points",
                outcomes: [
                  {
                    name: "Over",
                    description: "Jayson Tatum",
                    price: 1.85,
                    point: 24.5,
                  },
                ],
              },
              {
                key: "player_rebounds",
                outcomes: [
                  {
                    name: "Over",
                    description: "Jayson Tatum",
                    price: 1.7,
                    point: 6.5,
                  },
                ],
              },
            ],
          },
        ],
      },
    ];
    const { best } = extractOddsBundles(events);
    expect(best.get("jayson tatum|pts|25")?.price).toBe(1.85);
    expect(best.get("jayson tatum|reb|7")?.price).toBe(1.7);
  });

  it("fixture attaches pts/reb/ast to picks", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const { picks } = runModelFromFixture(root);
    const counts = countPricedLegsByMarket(picks);
    expect(counts.pts?.priced).toBeGreaterThan(0);
    expect(counts.reb?.priced).toBeGreaterThan(0);
    expect(counts.ast?.priced).toBeGreaterThan(0);
    const wag = picks.find(
      (p) => p.playerName === "Franz Wagner" && p.market === "pts" && p.line === 20
    );
    expect(wag?.bestPrice).toBe(1.45);
    expect(wag?.bestBookie).toBe("Sportsbet");
  });
});