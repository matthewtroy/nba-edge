import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import type { PickLeg } from "../lib/types.js";
import type { OddsCacheFile } from "../lib/odds-cache-file.js";
import {
  countPricedPickLegs,
  oddsMapDowngradeBlocked,
  persistDataBranchGuardReason,
  slateOddsSnapshotKeyCount,
} from "../lib/odds-cache-guard.js";
import {
  historyEntryCount,
  persistJsonShrinkReason,
  recordKeyCount,
} from "../lib/espn-cache-guard.js";
import { isPostTipOff } from "../lib/odds-cache-merge.js";
import type { HistoryJson, SlateGame } from "../lib/types.js";
import type { DataIndexFile } from "../lib/data-index.js";
import {
  indexRetentionDropReason,
  listDataBranchRetainedFolders,
} from "../lib/index-guard.js";
import type { ResultsSlice } from "../lib/results-types.js";
import { resultsPersistShrinkReason } from "../lib/results-persist-guard.js";
import { injuryStatusHistoryEntryCount } from "../lib/injury-status-history.js";
import type { InjuryStatusHistoryFile } from "../lib/injury-status-history-ui.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staging = process.argv[2];
if (!staging || !fs.existsSync(staging)) {
  console.error("Usage: tsx scripts/persist-guard-check.ts <staging/public/data>");
  process.exit(2);
}

const forceOdds = process.env.PIPELINE_FORCE_ODDS === "1";
const now = new Date();

const indexPath = path.join(staging, "index.json");
let defaultDate: string | null = null;
let stagingIndex: DataIndexFile | null = null;
if (fs.existsSync(indexPath)) {
  try {
    stagingIndex = JSON.parse(fs.readFileSync(indexPath, "utf8")) as DataIndexFile;
    defaultDate = stagingIndex.defaultDate ?? null;
  } catch {
    /* ignore */
  }
}

let priorIndex: DataIndexFile | null = null;
try {
  const raw = execFileSync("git", ["show", "origin/data:public/data/index.json"], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  priorIndex = JSON.parse(raw) as DataIndexFile;
} catch {
  priorIndex = null;
}

if (stagingIndex) {
  const branchFolders = listDataBranchRetainedFolders(rootDir, now);
  const indexDrop = indexRetentionDropReason(priorIndex, stagingIndex, now, {
    dataBranchFolders: branchFolders,
  });
  if (indexDrop) {
    console.error(`persist data branch guard: blocked — ${indexDrop}`);
    process.exit(1);
  }
}

let defaultSlate: SlateGame[] = [];
if (defaultDate) {
  const slatePath = path.join(staging, defaultDate, "slate.json");
  if (fs.existsSync(slatePath)) {
    try {
      defaultSlate = JSON.parse(fs.readFileSync(slatePath, "utf8")) as SlateGame[];
    } catch {
      defaultSlate = [];
    }
  }
}
const postTipOff = isPostTipOff(now, defaultSlate);

let pricedLegs = 0;
if (defaultDate) {
  const picksPath = path.join(staging, defaultDate, "picks.json");
  if (fs.existsSync(picksPath)) {
    const picks = JSON.parse(fs.readFileSync(picksPath, "utf8")) as PickLeg[];
    pricedLegs = countPricedPickLegs(picks);
  }
}

const nextCachePath = path.join(staging, "odds-cache.json");
const nextCache: OddsCacheFile = fs.existsSync(nextCachePath)
  ? (JSON.parse(fs.readFileSync(nextCachePath, "utf8")) as OddsCacheFile)
  : {};
const nextSlateCacheKeys = defaultDate ? slateOddsSnapshotKeyCount(nextCache, defaultDate) : 0;

let priorPricedLegsOnSlate = 0;
let priorSlateCacheKeys = 0;
if (defaultDate) {
  try {
    const raw = execFileSync(
      "git",
      ["show", `origin/data:public/data/${defaultDate}/picks.json`],
      { cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    priorPricedLegsOnSlate = countPricedPickLegs(JSON.parse(raw) as PickLeg[]);
  } catch {
    priorPricedLegsOnSlate = 0;
  }
  try {
    const raw = execFileSync("git", ["show", "origin/data:public/data/odds-cache.json"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const prior = JSON.parse(raw) as OddsCacheFile;
    priorSlateCacheKeys = slateOddsSnapshotKeyCount(prior, defaultDate);
  } catch {
    priorSlateCacheKeys = 0;
  }
}

function readJsonFromDataBranch(relPath: string): unknown | null {
  try {
    const raw = execFileSync("git", ["show", `origin/data:${relPath}`], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

{
  const priorResults = readJsonFromDataBranch("public/data/results.json") as ResultsSlice | null;
  const resultsStagingPath = path.join(staging, "results.json");
  let nextResults: ResultsSlice | null = null;
  if (fs.existsSync(resultsStagingPath)) {
    try {
      nextResults = JSON.parse(fs.readFileSync(resultsStagingPath, "utf8")) as ResultsSlice;
    } catch {
      nextResults = null;
    }
  }
  const resultsShrink = resultsPersistShrinkReason(priorResults, nextResults);
  if (resultsShrink) {
    console.error(`persist data branch guard: blocked — ${resultsShrink}`);
    process.exit(1);
  }
}

function countPersistedFile(relPath: string, stagingPath: string): number {
  if (!fs.existsSync(stagingPath)) return 0;
  try {
  const next = JSON.parse(fs.readFileSync(stagingPath, "utf8")) as unknown;
  if (relPath.endsWith("history.json")) {
    return historyEntryCount(next as HistoryJson);
  }
  if (relPath.endsWith("injury-status-history.json")) {
    return injuryStatusHistoryEntryCount(next as InjuryStatusHistoryFile);
  }
  return recordKeyCount(next as Record<string, unknown>);
  } catch {
    return 0;
  }
}

const jsonShrinkChecks: { rel: string; label: string }[] = [
  { rel: "public/data/game-log-cache.json", label: "game-log-cache.json" },
  { rel: "public/data/h2h-season-cache.json", label: "h2h-season-cache.json" },
  { rel: "public/data/history.json", label: "history.json" },
  { rel: "public/data/injury-status-history.json", label: "injury-status-history.json" },
];

for (const { rel, label } of jsonShrinkChecks) {
  const priorRaw = readJsonFromDataBranch(rel);
  let priorCount = 0;
  if (priorRaw != null) {
    if (rel.endsWith("history.json")) {
      priorCount = historyEntryCount(priorRaw as HistoryJson);
    } else if (rel.endsWith("injury-status-history.json")) {
      priorCount = injuryStatusHistoryEntryCount(priorRaw as InjuryStatusHistoryFile);
    } else {
      priorCount = recordKeyCount(priorRaw as Record<string, unknown>);
    }
  }
  const nextCount = countPersistedFile(rel, path.join(staging, path.basename(rel)));
  const shrinkReason = persistJsonShrinkReason(label, priorCount, nextCount, {
    postTipOff,
  });
  if (shrinkReason) {
    console.error(`persist data branch guard: blocked — ${shrinkReason}`);
    process.exit(1);
  }
}

const reason =
  postTipOff && pricedLegs === 0 && priorPricedLegsOnSlate > 0
    ? null
    : persistDataBranchGuardReason({
        defaultSlateDate: defaultDate,
        pricedLegs,
        priorPricedLegsOnSlate,
        priorSlateCacheKeys,
        nextSlateCacheKeys,
        forceOdds:
          forceOdds ||
          (postTipOff &&
            oddsMapDowngradeBlocked(priorSlateCacheKeys, nextSlateCacheKeys, {
              forceOddsPullSucceeded: false,
            })),
      });

if (reason) {
  console.error(`persist data branch guard: blocked — ${reason}`);
  process.exit(1);
}

const slateLabel = defaultDate ?? "?";
console.log(
  `persist data branch guard: ok · slate ${slateLabel} · ${pricedLegs} priced (was ${priorPricedLegsOnSlate}) · slate cache ${priorSlateCacheKeys}→${nextSlateCacheKeys} keys`
);
process.exit(0);