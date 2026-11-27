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
import { synthesizeOfferedRung } from "../lib/offered-bookie-lines";
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

    const main = lineLeg({
      id: "spencer-ast-5",
      gameId: "g1",
      playerId: "spencer",
      playerName: "Cam Spencer",
      market: "ast",
      line: 5,
      fairPrice: 1.31,
      bookiePrices: { Sportsbet: 1.96 },
      bestPrice: 1.96,
    });
    const catalog: PickLeg[] = [
      main,
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
    ];
    const rung = synthesizeOfferedRung(main, 6, "Sportsbet", catalog);
    expect(rung?.line).toBe(6);
    expect(rung?.bestPrice).toBe(2.79);
    expect(bookiePriceFromOfferedMap(rung?.bookiePrices, "Sportsbet")).toBe(2.79);
  });
});