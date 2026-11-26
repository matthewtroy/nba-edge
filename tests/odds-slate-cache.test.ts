import { describe, expect, it } from "vitest";
import { expandOddsMapForPlayers } from "../lib/odds-attach";
import { buildLegsForPlayer } from "../lib/pricing";
import {
  mergePricingMaps,
  resolveSlateOddsMaps,
} from "../lib/odds-slate-cache";
import type { OddsCacheFile } from "../lib/odds-cache-file";
import type { SlateGame } from "../lib/types";

const slate: SlateGame[] = [
  {
    id: "401",
    startTime: "2026-11-26T02:00:00Z",
    startTimeSydney: "",
    homeTeam: "Heat",
    awayTeam: "Knicks",
    homeTeamId: "t1",
    awayTeamId: "t2",
    homeB2B: false,
    awayB2B: false,
    status: "pre",
  },
];

describe("odds slate cache", () => {
  it("skip-odds run merges global cache into slate map", () => {
    const cache: OddsCacheFile = {
      lastPulled: "2026-11-24T22:58:43.102Z",
      oddsMap: {
        "franz wagner|pts|20": { price: 1.9, bookie: "Sportsbet" },
        "other player|pts|10": { price: 2.1, bookie: "Neds" },
      },
    };
    const maps = resolveSlateOddsMaps(
      cache,
      "2026-11-26",
      slate,
      ["Franz Wagner", "Other"],
      new Map([
        ["franz wagner", "t1"],
        ["other player", "t9"],
      ])
    );
    expect(maps.best.has("franz wagner|pts|20")).toBe(true);
    expect(maps.best.has("other player|pts|10")).toBe(false);
  });

  it("partial pull keeps cached keys via merge", () => {
    const cached = new Map([["a|pts|10", { price: 1.8, bookie: "TAB" }]]);
    const fresh = new Map([["b|pts|15", { price: 2.0, bookie: "Neds" }]]);
    const merged = mergePricingMaps(cached, fresh);
    expect(merged.size).toBe(2);
  });

  it("partial merge keeps both cached and fresh keys", () => {
    const cached = new Map([["old|pts|10", { price: 1.7, bookie: "TAB" }]]);
    const fresh = new Map([["new|reb|5", { price: 1.9, bookie: "Sportsbet" }]]);
    const merged = mergePricingMaps(cached, fresh);
    expect(merged.get("old|pts|10")?.price).toBe(1.7);
    expect(merged.get("new|reb|5")?.price).toBe(1.9);
  });

  it("skip-odds cache attaches bestPrice on legs", () => {
    const cache: OddsCacheFile = {
      lastPulled: "2026-11-25T05:16:23.081Z",
      oddsMap: {
        "franz wagner|pts|20": { price: 1.85, bookie: "Sportsbet" },
      },
      bySlateDate: {
        "2026-11-26": {
          lastPulled: "2026-11-25T05:16:23.081Z",
          oddsMap: {
            "franz wagner|pts|20": { price: 1.85, bookie: "Sportsbet" },
          },
        },
      },
    };
    const maps = resolveSlateOddsMaps(
      cache,
      "2026-11-26",
      slate,
      ["Franz Wagner"],
      new Map([["franz wagner", "t1"]])
    );
    const pricing = expandOddsMapForPlayers(maps.best, ["Franz Wagner"]);
    const legs = buildLegsForPlayer({
      gameId: "401",
      team: "Heat",
      opponent: "Knicks",
      playerId: "p1",
      playerName: "Franz Wagner",
      headshotUrl: "",
      stats: { pts: 24, reb: 5, ast: 4, threes: 2 },
      logs: Array.from({ length: 10 }, (_, i) => ({
        date: `2026-11-${String(10 + i).padStart(2, "0")}`,
        pts: 24,
        reb: 5,
        ast: 4,
        threes: 2,
        minutes: 34,
        opponent: "Knicks",
      })),
      reasons: [],
      tags: [],
      flags: {},
      bestOdds: pricing,
      oddsPulledAt: maps.lastPulled,
      minEdge: 0.08,
    });
    const pts20 = legs.find((l) => l.market === "pts" && l.line === 20);
    expect(pts20?.bestPrice).toBeGreaterThan(1);
  });
});