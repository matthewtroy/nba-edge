import { describe, it, expect } from "vitest";
import { oddsApiMarketToLeg } from "../lib/odds";

describe("oddsApiMarketToLeg", () => {
  it("maps API keys to leg markets", () => {
    expect(oddsApiMarketToLeg("player_points")).toBe("pts");
    expect(oddsApiMarketToLeg("player_rebounds_alternate")).toBe("reb");
    expect(oddsApiMarketToLeg("player_assists")).toBe("ast");
    expect(oddsApiMarketToLeg("player_threes")).toBe("3pm");
    expect(oddsApiMarketToLeg("player_double_double")).toBe("dd");
    expect(oddsApiMarketToLeg("player_triple_double")).toBe("td");
  });
});