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
import { indexRetentionDropReason } from "../lib/index-guard.js";

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

if (stagingIndex && priorIndex) {
  const indexDrop = indexRetentionDropReason(priorIndex, stagingIndex, now);
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

function countPersistedFile(relPath: string, stagingPath: string): number {
  if (!fs.existsSync(stagingPath)) return 0;
  try {
  const next = JSON.parse(fs.readFileSync(stagingPath, "utf8")) as unknown;
  if (relPath.endsWith("history.json")) {
    return historyEntryCount(next as HistoryJson);
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
];

for (const { rel, label } of jsonShrinkChecks) {
  const priorRaw = readJsonFromDataBranch(rel);
  let priorCount = 0;
  if (priorRaw != null) {
    if (rel.endsWith("history.json")) {
      priorCount = historyEntryCount(priorRaw as HistoryJson);
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