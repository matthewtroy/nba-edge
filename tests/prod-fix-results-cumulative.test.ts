import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import {
  listAllSlateFoldersOnDataRef,
  listSlateFoldersOnDataRef,
  restorePersistedDataFromBranch,
  DATA_BRANCH_CUMULATIVE_SLATE_FILES,
} from "../lib/restore-data-branch";
import { retentionMinYmd } from "../lib/slate-retention";
import { listSettleSlateDates, listRegradeSlateDates } from "../lib/settle-slate-list";
import { resultsPersistShrinkReason } from "../lib/results-persist-guard";
import type { ResultsSlice } from "../lib/results-types";
import { BET_LABELS } from "../lib/official-bet-settle";

function git(cwd: string, ...args: string[]) {
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" });
}

function emptySlice(legs: number, mainPlay = 1): ResultsSlice {
  return {
    updatedAt: new Date().toISOString(),
    official: {
      record: { won: 0, lost: 0, void: 0, staked: 0, profit: 0, roi: null, bets: mainPlay },
      byBetType: {
        [BET_LABELS.mainPlay]: {
          won: 0,
          lost: 0,
          void: 0,
          staked: 0,
          profit: 0,
          roi: null,
          bets: mainPlay,
        },
        [BET_LABELS.booster]: {
          won: 0,
          lost: 0,
          void: 0,
          staked: 0,
          profit: 0,
          roi: null,
          bets: 2,
        },
      },
      last14d: [],
      bets: [],
      legs: [],
    },
    valueLegs: {
      record: {
        won: 0,
        lost: 0,
        void: 0,
        staked: legs,
        profit: 0,
        roi: null,
        legs,
        hitRate: null,
        avgPrice: null,
        beatMarket: null,
      },
      byMarket: {},
      byEdgeBand: {},
      legs: [],
    },
    model: {
      calibration: [],
      brierLive: null,
      brierShadow: null,
      tagHitRates: {},
    },
    gradedLegs: [],
    gamesSgm: { bets: [{ slateDate: "2026-11-26" } as never, { slateDate: "2026-11-26" } as never] },
  };
}

describe("cumulative results retention", () => {
  const incidentNow = new Date("2026-11-27T04:00:00.000Z");

  it("lists all vs retained slate folders on data ref", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nba-cum-"));
    const repo = path.join(tmp, "repo");
    try {
      git(tmp, "init", repo);
      for (const ymd of ["2026-11-25", "2026-11-26", "2026-11-28"]) {
        const dir = path.join(repo, "public/data", ymd);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "results.json"), "{}");
        git(repo, "add", `public/data/${ymd}`);
      }
      for (const root of ["history.json", "odds-cache.json", "index.json", "game-log-cache.json"]) {
        fs.writeFileSync(path.join(repo, "public/data", root), "{}");
        git(repo, "add", `public/data/${root}`);
      }
      git(repo, "-c", "user.email=t@t.com", "-c", "user.name=T", "commit", "-m", "data");
      git(repo, "branch", "-M", "data");

      const all = listAllSlateFoldersOnDataRef(repo, "refs/heads/data");
      expect(all).toEqual(["2026-11-25", "2026-11-26", "2026-11-28"]);

      const retained = listSlateFoldersOnDataRef(repo, "refs/heads/data", incidentNow);
      expect(retentionMinYmd(incidentNow)).toBe("2026-11-26");
      expect(retained).toEqual(["2026-11-26", "2026-11-28"]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("restores results.json for a folder outside the retention window", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nba-cum-restore-"));
    const repo = path.join(tmp, "repo");
    const ymd = "2026-11-25";
    try {
      git(tmp, "init", repo);
      fs.mkdirSync(path.join(repo, "public/data", ymd), { recursive: true });
      fs.writeFileSync(
        path.join(repo, "public/data", ymd, "results.json"),
        JSON.stringify({ marker: "nov25" })
      );
      for (const root of ["history.json", "odds-cache.json", "index.json", "game-log-cache.json"]) {
        fs.writeFileSync(path.join(repo, "public/data", root), "{}");
        git(repo, "add", `public/data/${root}`);
      }
      git(repo, "add", `public/data/${ymd}`);
      git(repo, "-c", "user.email=t@t.com", "-c", "user.name=T", "commit", "-m", "data");
      git(repo, "branch", "-M", "data");

      const { restored } = restorePersistedDataFromBranch(repo);
      expect(DATA_BRANCH_CUMULATIVE_SLATE_FILES).toContain("results.json");
      expect(restored).toContain(`public/data/${ymd}/results.json`);
      const body = JSON.parse(
        fs.readFileSync(path.join(repo, "public/data", ymd, "results.json"), "utf8")
      );
      expect(body.marker).toBe("nov25");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("includes out-of-retention settle dates when results.json is on disk", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nba-cum-list-"));
    const repo = path.join(tmp, "repo");
    const dataRoot = path.join(repo, "public/data");
    try {
      git(tmp, "init", repo);
      const ymd = "2026-11-25";
      fs.mkdirSync(path.join(dataRoot, ymd), { recursive: true });
      fs.writeFileSync(path.join(dataRoot, ymd, "results.json"), "{}");
      for (const root of ["history.json", "odds-cache.json", "index.json", "game-log-cache.json"]) {
        fs.writeFileSync(path.join(dataRoot, root), "{}");
        git(repo, "add", `public/data/${root}`);
      }
      git(repo, "add", `public/data/${ymd}`);
      git(repo, "-c", "user.email=t@t.com", "-c", "user.name=T", "commit", "-m", "data");
      git(repo, "branch", "-M", "data");

      const dates = listSettleSlateDates(repo, dataRoot, incidentNow);
      expect(dates).toContain("2026-11-25");

      const regrade = listRegradeSlateDates(dates, incidentNow, () => true);
      expect(regrade).toEqual([]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("persist guard blocks Singles legs drop", () => {
    const prior = emptySlice(58);
    const next = emptySlice(40);
    const reason = resultsPersistShrinkReason(prior, next);
    expect(reason).toMatch(/Singles legs 40 < data branch 58/);
  });

  it("persist guard allows equal or increased totals", () => {
    const prior = emptySlice(316);
    const next = emptySlice(374);
    expect(resultsPersistShrinkReason(prior, next)).toBeNull();
  });
});