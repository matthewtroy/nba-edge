import { describe, it, expect } from "vitest";
import { buildOddsCoverage } from "../lib/odds-coverage";

describe("buildOddsCoverage", () => {
  it("flags threes-only response", () => {
    const events = [
      {
        bookmakers: [
          {
            markets: [
              {
                key: "player_threes",
                outcomes: [{ description: "Player A" }, { description: "Player B" }],
              },
            ],
          },
        ],
      },
    ];
    const cov = buildOddsCoverage(events, new Date().toISOString());
    expect(cov.onlyThreesOffered).toBe(true);
    expect(cov.note).toMatch(/threes-only/i);
  });

  it("counts core markets", () => {
    const events = [
      {
        bookmakers: [
          {
            markets: [
              {
                key: "player_points",
                outcomes: [{ description: "A" }],
              },
              {
                key: "player_rebounds_alternate",
                outcomes: [{ description: "B" }],
              },
            ],
          },
        ],
      },
    ];
    const cov = buildOddsCoverage(events, new Date().toISOString());
    expect(cov.onlyThreesOffered).toBe(false);
    expect(cov.uniquePlayersByCoreMarket.pts).toBe(1);
    expect(cov.uniquePlayersByCoreMarket.reb).toBe(1);
  });
});