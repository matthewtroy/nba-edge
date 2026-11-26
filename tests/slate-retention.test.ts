import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { SlateGame } from "../lib/types";
import {
  mergePlanWithPersisted,
  mergeRetainedIndexEntries,
  planScoreboardSlates,
  retentionMinYmd,
} from "../lib/slate-retention";
import { indexRetentionDropReason } from "../lib/index-guard";
import { buildDataIndex, type DataIndexDateEntry } from "../lib/data-index";

function game(
  id: string,
  iso: string,
  status = "in",
  home = "Golden State Warriors",
  away = "Sacramento Kings"
): SlateGame {
  return {
    id,
    startTime: iso,
    startTimeSydney: "",
    homeTeam: home,
    awayTeam: away,
    homeTeamId: "9",
    awayTeamId: "23",
    homeB2B: false,
    awayB2B: false,
    status,
  };
}

describe("slate retention (Thanksgiving ET)", () => {
  const incidentNow = new Date("2026-11-26T05:15:00.000Z");

  it("keeps Sydney 2026-11-26 slate when ET scoreboard is empty but SAC@GSW is live", () => {
    const liveSacGsw = game("401909999", "2026-11-26T02:30:00.000Z", "in");
    const plan = planScoreboardSlates([liveSacGsw], incidentNow);
    expect(plan.today.map((g) => g.id)).toEqual(["401909999"]);
  });

  it("loads today slate from disk when US scoreboard has no games", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nba-ret-"));
    const ymd = "2026-11-26";
    const dir = path.join(tmp, ymd);
    fs.mkdirSync(dir, { recursive: true });
    const g = game("401909999", "2026-11-26T02:30:00.000Z", "in");
    fs.writeFileSync(path.join(dir, "slate.json"), JSON.stringify([g]));
    fs.writeFileSync(
      path.join(dir, "meta.json"),
      JSON.stringify({
        lastUpdated: incidentNow.toISOString(),
        sources: {},
        slateSize: 1,
      })
    );
    fs.writeFileSync(path.join(dir, "picks.json"), "[]");
    fs.writeFileSync(path.join(dir, "multis.json"), JSON.stringify({ bets: [] }));

    const plan = mergePlanWithPersisted({ today: [], tomorrow: [] }, tmp, incidentNow);
    expect(plan.today).toHaveLength(1);
    expect(plan.today[0]!.awayTeam).toBe("Sacramento Kings");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("retention cutoff is Sydney today − 1", () => {
    expect(retentionMinYmd(incidentNow)).toBe("2026-11-25");
  });

  it("mergeRetainedIndexEntries keeps disk slate in index when pipeline built only tomorrow", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nba-ret-idx-"));
    const ymd = "2026-11-26";
    const dir = path.join(tmp, ymd);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "slate.json"),
      JSON.stringify([game("x", "2026-11-26T02:30:00.000Z")])
    );
    fs.writeFileSync(
      path.join(dir, "meta.json"),
      JSON.stringify({
        lastUpdated: incidentNow.toISOString(),
        sources: {},
        slateSize: 1,
      })
    );
    fs.writeFileSync(path.join(dir, "picks.json"), "[]");
    fs.writeFileSync(path.join(dir, "multis.json"), JSON.stringify({ bets: [] }));

    const built: DataIndexDateEntry[] = [
      {
        date: "2026-11-27",
        status: "draft",
        statusLabel: "Draft",
        gameCount: 4,
        legCount: 1,
        multiCount: 1,
        lastUpdated: incidentNow.toISOString(),
        firstTipIso: "2026-11-27T09:00:00.000Z",
      },
    ];
    const merged = mergeRetainedIndexEntries(built, tmp, incidentNow);
    expect(merged.map((e) => e.date)).toEqual(["2026-11-26", "2026-11-27"]);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("index guard blocks dropping retained slate folder", () => {
    const prior = buildDataIndex(
      [
        {
          date: "2026-11-26",
          status: "draft",
          statusLabel: "Draft",
          gameCount: 1,
          legCount: 1,
          multiCount: 1,
          lastUpdated: incidentNow.toISOString(),
        },
      ],
      incidentNow
    );
    const next = buildDataIndex([], incidentNow);
    expect(indexRetentionDropReason(prior, next, incidentNow)).toMatch(/2026-11-26/);
  });
});