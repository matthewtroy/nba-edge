import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  bookiePriceFromOfferedMap,
  offeredBookiePrices,
  resetOfferedBookieCacheForTests,
  setOfferedBookieCachePathForTests,
} from "../lib/offered-bookie-lines";
import { buildMultis } from "../lib/multis";
import { legPriceAtBookie } from "../lib/single-bookie";
import type { PickLeg } from "../lib/types";

function lineLeg(
  opts: Partial<PickLeg> & Pick<PickLeg, "id" | "gameId" | "playerId" | "playerName" | "market" | "line" | "fairPrice">
): PickLeg {
  const sb = 1.5;
  return {
    team: "T",
    opponent: "O",
    headshotUrl: "",
    probability: 0.75,
    modelProbability: 0.75,
    takeAt: opts.fairPrice * 1.08,
    starter: true,
    starterEligible: true,
    tags: ["High probability"],
    reasons: [{ type: "form", text: "8/10 at this line" }],
    recentTenVsLine: Array(10).fill("hit"),
    bestPrice: sb,
    bestBookie: "Sportsbet",
    bookiePrices: { Sportsbet: sb },
    ...opts,
  };
}

describe("offered-bookie-lines allOddsMap", () => {
  let tmp: string;

  afterEach(() => {
    resetOfferedBookieCacheForTests();
    delete process.env.PIPELINE_SLATE_DATE;
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("exact bySlateDate cache entry → Sportsbet ast 6 @ 2.79", () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "odds-cache-"));
    const cachePath = path.join(tmp, "odds-cache.json");
    fs.writeFileSync(
      cachePath,
      JSON.stringify({
        bySlateDate: {
          "2026-11-28": {
            lastPulled: "x",
            oddsMap: {},
            allOddsMap: {
              "cam spencer|ast|5": { SportsBet: 1.96 },
              "cam spencer|ast|6": { SportsBet: 2.79 },
              "cam spencer|ast|8": { SportsBet: 6 },
              "cam spencer|ast|10": { SportsBet: 12 },
            },
          },
        },
      })
    );
    process.env.PIPELINE_SLATE_DATE = "2026-11-28";
    setOfferedBookieCachePathForTests(cachePath);

    const p6 = offeredBookiePrices("Cam Spencer", "ast", 6);
    expect(bookiePriceFromOfferedMap(p6, "Sportsbet")).toBe(2.79);

    const picks: PickLeg[] = [
      lineLeg({
        id: "spencer-ast-5",
        gameId: "g1",
        playerId: "spencer",
        playerName: "Cam Spencer",
        market: "ast",
        line: 5,
        fairPrice: 1.31,
        bookiePrices: { Sportsbet: 1.96 },
        bestPrice: 1.96,
      }),
      lineLeg({
        id: "spencer-ast-6",
        gameId: "g1",
        playerId: "spencer",
        playerName: "Cam Spencer",
        market: "ast",
        line: 6,
        fairPrice: 1.55,
        probability: 0.55,
        modelProbability: 0.55,
        bookiePrices: { Neds: 1.91 },
        bestPrice: 1.91,
        bestBookie: "Neds",
      }),
      lineLeg({
        id: "spencer-ast-8",
        gameId: "g1",
        playerId: "spencer",
        playerName: "Cam Spencer",
        market: "ast",
        line: 8,
        fairPrice: 1.7,
        probability: 0.55,
        modelProbability: 0.55,
        bookiePrices: { Sportsbet: 6 },
        bestPrice: 6,
      }),
      lineLeg({
        id: "spencer-ast-10",
        gameId: "g1",
        playerId: "spencer",
        playerName: "Cam Spencer",
        market: "ast",
        line: 10,
        fairPrice: 2.2,
        probability: 0.55,
        modelProbability: 0.55,
        bookiePrices: { Sportsbet: 12 },
        bestPrice: 12,
      }),
      lineLeg({
        id: "p2-pts-15",
        gameId: "g2",
        playerId: "p2",
        playerName: "Player 2",
        market: "pts",
        line: 15,
        fairPrice: 1.45,
        bookiePrices: { Sportsbet: 1.9 },
        bestPrice: 1.9,
      }),
      lineLeg({
        id: "p2-pts-20",
        gameId: "g2",
        playerId: "p2",
        playerName: "Player 2",
        market: "pts",
        line: 20,
        fairPrice: 1.75,
        bookiePrices: { Sportsbet: 2.55 },
        bestPrice: 2.55,
      }),
      lineLeg({
        id: "p3-pts-15",
        gameId: "g3",
        playerId: "p3",
        playerName: "Player 3",
        market: "pts",
        line: 15,
        fairPrice: 1.45,
        bookiePrices: { Sportsbet: 1.9 },
        bestPrice: 1.9,
      }),
      lineLeg({
        id: "p3-pts-20",
        gameId: "g3",
        playerId: "p3",
        playerName: "Player 3",
        market: "pts",
        line: 20,
        fairPrice: 1.75,
        bookiePrices: { Sportsbet: 2.55 },
        bestPrice: 2.55,
      }),
    ];

    const { bets } = buildMultis(picks, 3);
    const booster = bets.find((b) => b.type === "booster");
    expect(booster?.bestBookie).toBe("Sportsbet");
    const byId = new Map(picks.map((p) => [p.id, p]));
    const spencerBoost = booster!.legs
      .map((id) => byId.get(id)!)
      .find((l) => l.playerId === "spencer");
    expect(spencerBoost?.line).toBe(6);
    expect(spencerBoost?.fairPrice).toBe(1.55);
    expect(legPriceAtBookie(spencerBoost!, "Sportsbet")).toBe(2.79);
  });
});