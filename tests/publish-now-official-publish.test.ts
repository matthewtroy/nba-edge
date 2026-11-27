import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { writeOfficialCard } from "../lib/official-card";
import { computeSlateStatus } from "../lib/slate-publication";
import type { PickLeg, SlateGame } from "../lib/types";

const slate11 = Array.from({ length: 11 }, (_, i) => ({
  id: `g${i}`,
  startTime: "2026-11-28T02:00:00.000Z",
  startTimeSydney: "1pm",
  homeTeam: "Home",
  awayTeam: "Away",
  homeTeamId: `h${i}`,
  awayTeamId: `a${i}`,
  homeB2B: false,
  awayB2B: false,
  status: "pre" as const,
}));

describe("publish_now official card", () => {
  it("writes official-card.json with publishedAt despite gateViolations meta", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pub-now-"));
    const dir = path.join(tmp, "2026-11-28");
    fs.mkdirSync(dir, { recursive: true });
    const picks: PickLeg[] = [
      {
        id: "l1",
        playerId: "p1",
        playerName: "Player One",
        gameId: "g0",
        team: "Home",
        market: "pts",
        line: 20,
        fairPrice: 1.9,
        takeAt: 2.0,
        probability: 0.55,
        bestPrice: 1.95,
        bookie: "TAB",
        reasons: [],
      },
    ];
    const now = new Date("2026-11-27T06:00:00.000Z");
    const official = writeOfficialCard(dir, {
      now,
      slate: slate11 as SlateGame[],
      multis: [
        {
          type: "mainPlay",
          label: "Main Play",
          legs: ["l1"],
          combinedFairPrice: 2,
          bestBookie: "TAB",
          bestBookieTotal: 2.1,
          stakeUnits: 1,
        },
      ],
      notBuilt: [{ type: "boostSgm", reason: "gate: combined out of band" }],
      injuries: [],
      meta: {
        whatChanged: [],
        gateViolations: ["boostSgm: combined out of band"],
      },
      picks,
    });
    expect(official.publishedAt).toBeTruthy();
    expect(fs.existsSync(path.join(dir, "official-card.json"))).toBe(true);
    const { status, statusLabel } = computeSlateStatus(
      slate11 as SlateGame[],
      { slateTipDate: "2026-11-28", whatChanged: [] },
      official,
      now
    );
    expect(status).toBe("official");
    expect(statusLabel).toMatch(/published/i);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});