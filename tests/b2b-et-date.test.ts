import { describe, expect, it } from "vitest";
import {
  createB2bScoreboardParser,
  dateFromYyyymmddEt,
  formatYyyymmddInZone,
  previousEtYyyymmdd,
  teamIdsFromScoreboardDay,
} from "../scripts/espn-parse";

function mockBoard(pairs: { home: string; away: string; date?: string }[]) {
  return {
    events: pairs.map((p, i) => ({
      id: String(401900000 + i),
      date: p.date ?? "2026-11-27T00:00Z",
      competitions: [
        {
          date: p.date ?? "2026-11-28T00:00Z",
          competitors: [
            { id: p.home, homeAway: "home", team: { id: p.home, displayName: `H${p.home}` } },
            { id: p.away, homeAway: "away", team: { id: p.away, displayName: `A${p.away}` } },
          ],
        },
      ],
    })),
  };
}

function ymdFromDate(d: Date): string {
  return formatYyyymmddInZone(d, "America/New_York");
}

describe("per-game ET B2B flags", () => {
  it("Fri slate with no Thu games: no B2B even if Wed had games", async () => {
    const boards = new Map<string, unknown>([
      ["20261126", mockBoard([{ home: "14", away: "20" }])],
      ["20261127", mockBoard([])],
    ]);
    const parser = createB2bScoreboardParser(async (d) => {
      const ymd = ymdFromDate(d);
      return boards.get(ymd) ?? { events: [] };
    });
    parser.seedEtDay("20261126", boards.get("20261126")!);
    parser.seedEtDay("20261127", boards.get("20261127")!);
    const fri = mockBoard([
      { home: "18", away: "14", date: "2026-11-28T00:00Z" },
      { home: "8", away: "15", date: "2026-11-28T00:30Z" },
    ]);
    const games = await parser.parseScoreboardForEtDay("20261128", fri);
    expect(games.length).toBe(2);
    expect(games.every((g) => !g.homeB2B && !g.awayB2B)).toBe(true);
  });

  it("scheduled (non-final) Thu game flags B2B on Fri", async () => {
    const thu = mockBoard([{ home: "14", away: "99", date: "2026-11-27T12:00Z" }]);
    const boards = new Map<string, unknown>([["20261127", thu]]);
    const parser = createB2bScoreboardParser(async (d) => {
      const ymd = ymdFromDate(d);
      return boards.get(ymd) ?? { events: [] };
    });
    parser.seedEtDay("20261127", thu);
    const fri = mockBoard([{ home: "18", away: "14", date: "2026-11-28T00:00Z" }]);
    const games = await parser.parseScoreboardForEtDay("20261128", fri);
    expect(games[0].homeB2B).toBe(false);
    expect(games[0].awayB2B).toBe(true);
  });

  it("forward-scan board D uses D−1, not run-day yesterday", async () => {
    const runDayPrev = mockBoard([{ home: "99", away: "98" }]);
    const boardPrevForFri = mockBoard([]);
    const fetched = new Set<string>();
    const parser = createB2bScoreboardParser(async (d) => {
      const ymd = ymdFromDate(d);
      fetched.add(ymd);
      if (ymd === "20261126") return runDayPrev;
      if (ymd === "20261127") return boardPrevForFri;
      return { events: [] };
    });
    parser.seedEtDay("20261126", runDayPrev);
    const fri = mockBoard([{ home: "11", away: "20", date: "2026-11-28T00:30Z" }]);
    const games = await parser.parseScoreboardForEtDay("20261128", fri);
    expect(games[0].homeB2B).toBe(false);
    expect(games[0].awayB2B).toBe(false);
    expect(fetched.has("20261127")).toBe(true);
    expect(teamIdsFromScoreboardDay(runDayPrev).has("99")).toBe(true);
  });

  it("previousEtYyyymmdd steps one ET calendar day", () => {
    expect(previousEtYyyymmdd("20261128")).toBe("20261127");
    const d = dateFromYyyymmddEt("20260309");
    expect(previousEtYyyymmdd(formatYyyymmddInZone(d, "America/New_York"))).toBe("20260308");
  });
});