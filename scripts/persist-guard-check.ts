import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import type { PickLeg } from "../lib/types.js";
import type { OddsCacheFile } from "../lib/odds-cache-file.js";
import {
  countPricedPickLegs,
  persistDataBranchGuardReason,
  slateOddsSnapshotKeyCount,
} from "../lib/odds-cache-guard.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staging = process.argv[2];
if (!staging || !fs.existsSync(staging)) {
  console.error("Usage: tsx scripts/persist-guard-check.ts <staging/public/data>");
  process.exit(2);
}

const forceOdds = process.env.PIPELINE_FORCE_ODDS === "1";

const indexPath = path.join(staging, "index.json");
let defaultDate: string | null = null;
if (fs.existsSync(indexPath)) {
  try {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8")) as { defaultDate?: string };
    defaultDate = index.defaultDate ?? null;
  } catch {
    /* ignore */
  }
}

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

const reason = persistDataBranchGuardReason({
  defaultSlateDate: defaultDate,
  pricedLegs,
  priorPricedLegsOnSlate,
  priorSlateCacheKeys,
  nextSlateCacheKeys,
  forceOdds,
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