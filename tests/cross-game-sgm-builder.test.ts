import { describe, expect, it } from "vitest";
import type { PickLeg, SlateGame } from "../lib/types";
import {
  qualifiesCrossGameSgmLeg,
  crossGameLegIsHighProb,
} from "../lib/cross-game-sgm-leg";
import {
  pickBestCrossGameLegPair,
  pickCrossGameLegsForGame,
  CROSS_SGM_MIN_GAMES,
  CROSS_LEGS_PER_GAME,
} from "../lib/same-game-sgm-search";
import { buildMultis } from "../lib/multis";
import { gateAllMultis } from "../lib/multi-gate";
import { isSgmMainLine } from "../lib/main-play-eligibility";
import {
  crossGameMultiHasClash,
  legsClash,
  multiHasClash,
  sameGameSgmLegsClash,
} from "../lib/clash";
import { legPriceAtBookie } from "../lib/single-bookie";
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

  it("excludes sub-ladder rungs (isSgmMainLine only in cross gate)", () => {
    const subReb = leg({
      id: "sub",
      gameId: "g1",
      playerId: "psub",
      market: "reb",
      line: 3,
    });
    expect(qualifiesCrossGameSgmLeg(subReb, "Sportsbet", [subReb])).toBe(false);
    const mainReb = leg({
      id: "main",
      gameId: "g1",
      playerId: "pmain",
      market: "reb",
      line: 5,
    });
    expect(qualifiesCrossGameSgmLeg(mainReb, "Sportsbet", [mainReb])).toBe(true);
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

  it("resolves bookie prices case-insensitively", () => {
    const l = leg({
      id: "e",
      gameId: "g1",
      playerId: "pe",
      bookiePrices: { ladbrokes: 1.7 },
    });
    expect(legPriceAtBookie(l, "Ladbrokes")).toBe(1.7);
    expect(legPriceAtBookie(l, "ladbrokes")).toBe(1.7);
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

  it("uses relaxed Best SGM clash (not full multi clash)", () => {
    const a = leg({
      id: "rb1",
      gameId: "g",
      playerId: "a",
      team: "HOM",
      market: "reb",
      line: 5,
      probability: 0.76,
    });
    const b = leg({
      id: "rb2",
      gameId: "g",
      playerId: "b",
      team: "AWY",
      market: "reb",
      line: 5,
      probability: 0.74,
    });
    expect(legsClash(a, b)).toBe(true);
    expect(sameGameSgmLegsClash(a, b)).toBe(false);
    const pair = pickBestCrossGameLegPair([a, b]);
    expect(pair).toHaveLength(2);
  });
});

describe("pickCrossGameLegsForGame", () => {
  it("falls back to one leg when no pair exists", () => {
    const only = leg({ id: "solo", gameId: "g", playerId: "x", probability: 0.8 });
    expect(pickCrossGameLegsForGame([only])).toEqual([only]);
  });
});

describe("2026-11-28 cross gate (public data)", () => {
  const DATA = path.join(process.cwd(), "public/data/2026-11-28");

  it("built cross passes gate with no sub-ladder legs", () => {
    if (!fs.existsSync(path.join(DATA, "picks.json"))) return;
    const picks = JSON.parse(
      fs.readFileSync(path.join(DATA, "picks.json"), "utf8")
    ) as PickLeg[];
    const multis = JSON.parse(
      fs.readFileSync(path.join(DATA, "multis.json"), "utf8")
    ) as { bets: import("../lib/types.js").MultiBet[] };
    const pmap = new Map(picks.map((p) => [p.id, p]));
    const cross = multis.bets.find((b) => b.type === "crossGameSgm");
    if (!cross) return;
    const legs = cross.legs.map((id) => pmap.get(id)!).filter(Boolean);
    expect(legs.every((l) => isSgmMainLine(l.market, l.line))).toBe(true);
    const g = gateAllMultis(multis.bets, pmap, picks);
    expect(g.dropped.some((m) => m.type === "crossGameSgm")).toBe(false);
  });
});

describe("crossGameSgm builder", () => {
  const DATA = fixtureSlateDir("2026-11-26");

  it("notBuilt when fewer than 2 games qualify", () => {
    const picks = JSON.parse(
      fs.readFileSync(path.join(DATA, "picks.json"), "utf8")
    ) as PickLeg[];
    const games = JSON.parse(
      fs.readFileSync(path.join(DATA, "slate.json"), "utf8")
    ) as SlateGame[];
    const small = games.slice(0, 1);
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

  it("built cross allows 1–2 legs per game and omits Not included summary", () => {
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
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(CROSS_LEGS_PER_GAME);
    }
    expect(cross.summary?.includes("Not included")).toBe(false);
    const resolved = cross.legs
      .map((id) => picks.find((p) => p.id === id))
      .filter(Boolean) as PickLeg[];
    expect(crossGameMultiHasClash(resolved)).toBe(false);
  });
});