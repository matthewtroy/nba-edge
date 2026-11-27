import { describe, expect, it } from "vitest";
import type { PickLeg, SlateGame } from "../lib/types";
import {
  qualifiesCrossGameSgmLeg,
  crossGameLegIsHighProb,
} from "../lib/cross-game-sgm-leg";
import {
  pickBestCrossGameLegPair,
  CROSS_SGM_MIN_GAMES,
  CROSS_LEGS_PER_GAME,
} from "../lib/same-game-sgm-search";
import { buildMultis } from "../lib/multis";
import { multiHasClash } from "../lib/clash";
import { DEFAULT_MIN_EDGE } from "../lib/multi-combined";
import { fixtureSlateDir } from "./public-data-fixture";
import fs from "fs";
import path from "path";

function leg(partial: Partial<PickLeg> & Pick<PickLeg, "id" | "gameId" | "playerId">): PickLeg {
  return {
    playerName: "Player",
    team: "TST",
    market: "pts",
    line: 10,
    probability: 0.75,
    fairPrice: 1.5,
    takeAt: 1.62,
    projectedMinutes: 32,
    starterEligible: true,
    reasons: [{ type: "form", text: "7/10 at this line" }],
    recentTenVsLine: Array(10).fill("hit") as PickLeg["recentTenVsLine"],
    tags: ["High probability"],
    bookiePrices: { Sportsbet: 1.65 },
    bestPrice: 1.65,
    bestBookie: "Sportsbet",
    ...partial,
  };
}

describe("crossGameSgm leg gate", () => {
  const catalog = [leg({ id: "a", gameId: "g1", playerId: "p1" })];

  it("excludes value-only (no high prob)", () => {
    const l = leg({
      id: "v",
      gameId: "g1",
      playerId: "pv",
      tags: ["Value"],
      probability: 0.55,
    });
    expect(crossGameLegIsHighProb(l)).toBe(false);
    expect(qualifiesCrossGameSgmLeg(l, "Sportsbet", catalog)).toBe(false);
  });

  it("excludes below fair at bookie", () => {
    const l = leg({
      id: "b",
      gameId: "g1",
      playerId: "pb",
      fairPrice: 2,
      bookiePrices: { Sportsbet: 1.9 },
      bestPrice: 1.9,
    });
    expect(qualifiesCrossGameSgmLeg(l, "Sportsbet", [l])).toBe(false);
  });

  it("excludes Check news", () => {
    const l = leg({
      id: "c",
      gameId: "g1",
      playerId: "pc",
      tags: ["High probability", "Check news"],
    });
    expect(qualifiesCrossGameSgmLeg(l, "Sportsbet", [l])).toBe(false);
  });

  it("allows Value when also high prob and ≥ fair", () => {
    const l = leg({
      id: "d",
      gameId: "g1",
      playerId: "pd",
      tags: ["High probability", "Value"],
      takeAt: 1.55,
      fairPrice: 1.5,
      bookiePrices: { Sportsbet: 1.66 },
      bestPrice: 1.66,
    });
    expect(qualifiesCrossGameSgmLeg(l, "Sportsbet", [l])).toBe(true);
  });
});

describe("pickBestCrossGameLegPair", () => {
  it("picks max joint probability clash-free pair", () => {
    const pool = [
      leg({ id: "1", gameId: "g", playerId: "a", probability: 0.8, market: "pts", line: 10 }),
      leg({ id: "2", gameId: "g", playerId: "b", probability: 0.78, market: "reb", line: 5 }),
      leg({ id: "3", gameId: "g", playerId: "c", probability: 0.6, market: "ast", line: 5 }),
    ];
    const pair = pickBestCrossGameLegPair(pool);
    expect(pair).toHaveLength(2);
    expect(pair!.map((l) => l.id).sort()).toEqual(["1", "2"]);
    expect(multiHasClash(pair!)).toBe(false);
  });
});

describe("crossGameSgm builder", () => {
  const DATA = fixtureSlateDir("2026-11-26");

  it("notBuilt when slate has fewer than 6 games", () => {
    const picks = JSON.parse(
      fs.readFileSync(path.join(DATA, "picks.json"), "utf8")
    ) as PickLeg[];
    const games = JSON.parse(
      fs.readFileSync(path.join(DATA, "slate.json"), "utf8")
    ) as SlateGame[];
    const small = games.slice(0, 5);
    const { bets, notBuilt } = buildMultis(
      picks,
      small.length,
      300,
      DEFAULT_MIN_EDGE,
      [],
      undefined,
      small
    );
    expect(bets.find((m) => m.type === "crossGameSgm")).toBeUndefined();
    expect(
      notBuilt.some(
        (n) => n.type === "crossGameSgm" && n.reason.includes(`${CROSS_SGM_MIN_GAMES}`)
      )
    ).toBe(true);
  });

  it(`built cross has 2 legs per included game and lists excluded games`, () => {
    const picks = JSON.parse(
      fs.readFileSync(path.join(DATA, "picks.json"), "utf8")
    ) as PickLeg[];
    const games = JSON.parse(
      fs.readFileSync(path.join(DATA, "slate.json"), "utf8")
    ) as SlateGame[];
    if (games.length < CROSS_SGM_MIN_GAMES) return;
    const { bets } = buildMultis(
      picks,
      games.length,
      300,
      DEFAULT_MIN_EDGE,
      [],
      undefined,
      games
    );
    const cross = bets.find((m) => m.type === "crossGameSgm");
    if (!cross) return;
    const byGame = new Map<string, number>();
    for (const id of cross.legs) {
      const legRow = picks.find((p) => p.id === id)!;
      byGame.set(legRow.gameId, (byGame.get(legRow.gameId) ?? 0) + 1);
    }
    for (const n of byGame.values()) {
      expect(n).toBe(CROSS_LEGS_PER_GAME);
    }
    expect(cross.crossGameGroups?.some((g) => g.status === "excluded")).toBe(
      Boolean(cross.summary?.includes("Not included"))
    );
    const resolved = cross.legs
      .map((id) => picks.find((p) => p.id === id))
      .filter(Boolean) as PickLeg[];
    expect(multiHasClash(resolved)).toBe(false);
  });
});