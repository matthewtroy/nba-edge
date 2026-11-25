/**
 * One-shot repair: restore odds-cache.json from data commit a430109,
 * rebuild 2026-11-26 slate JSON without an odds pull, keep official-card.json as on origin/data.
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SLATE = "2026-11-26";
const GOOD_CACHE_COMMIT = "a430109";
const OFFICIAL_REL = `public/data/${SLATE}/official-card.json`;

const GIT_MAX_BUFFER = 64 * 1024 * 1024;

function gitShow(commit: string, rel: string): Buffer {
  return execFileSync("git", ["show", `${commit}:${rel}`], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: GIT_MAX_BUFFER,
  });
}

function writeFromRef(commit: string, rel: string, out: string): void {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, gitShow(commit, rel));
}

function countPriced(picksPath: string): number {
  const picks = JSON.parse(fs.readFileSync(picksPath, "utf8")) as {
    bestPrice?: number;
    bookiePrices?: Record<string, number>;
  }[];
  return picks.filter(
    (p) =>
      (p.bestPrice ?? 0) > 1 ||
      (p.bookiePrices && Object.values(p.bookiePrices).some((v) => v > 1))
  ).length;
}

execFileSync("git", ["fetch", "origin", "data:data"], { cwd: ROOT, stdio: "inherit" });

const officialBefore = gitShow("origin/data", OFFICIAL_REL);
writeFromRef(GOOD_CACHE_COMMIT, "public/data/odds-cache.json", path.join(ROOT, "public/data/odds-cache.json"));

for (const name of ["history.json", "index.json", "game-log-cache.json"] as const) {
  const rel = `public/data/${name}`;
  writeFromRef(GOOD_CACHE_COMMIT, rel, path.join(ROOT, "public/data", name));
}

fs.mkdirSync(path.join(ROOT, "public/data", SLATE), { recursive: true });
fs.writeFileSync(path.join(ROOT, OFFICIAL_REL), officialBefore);

const cache = JSON.parse(
  fs.readFileSync(path.join(ROOT, "public/data/odds-cache.json"), "utf8")
) as { oddsMap?: Record<string, unknown> };
console.log(
  `repair: restored odds-cache from ${GOOD_CACHE_COMMIT} · oddsMap ${Object.keys(cache.oddsMap ?? {}).length}`
);

execFileSync("npm", ["run", "pipeline"], {
  cwd: ROOT,
  stdio: "inherit",
  env: {
    ...process.env,
    SKIP_ODDS_PULL: "1",
    PIPELINE_FORCE_ODDS: "0",
    PIPELINE_SKIP_DATA_RESTORE: "1",
  },
});

const officialAfter = fs.readFileSync(path.join(ROOT, OFFICIAL_REL));
if (!officialAfter.equals(officialBefore)) {
  console.error("repair: official-card.json changed — restoring backup");
  fs.writeFileSync(path.join(ROOT, OFFICIAL_REL), officialBefore);
  process.exit(1);
}

const picksPath = path.join(ROOT, "public/data", SLATE, "picks.json");
const priced = countPriced(picksPath);
const cacheAfter = JSON.parse(
  fs.readFileSync(path.join(ROOT, "public/data/odds-cache.json"), "utf8")
) as { oddsMap?: Record<string, unknown> };
const cacheKeys = Object.keys(cacheAfter.oddsMap ?? {}).length;
console.log(`repair: slate ${SLATE} · ${priced} priced legs · oddsMap ${cacheKeys} keys`);

const persistOut = execFileSync("bash", ["scripts/persist-data-branch.sh"], {
  cwd: ROOT,
  encoding: "utf8",
  env: { ...process.env, PIPELINE_FORCE_ODDS: "0" },
});
console.log(persistOut.trim());
if (!/persist data branch: pushed/.test(persistOut)) {
  console.error("repair: persist did not push — aborting");
  process.exit(1);
}
if (priced === 0 || cacheKeys < 1000) {
  console.error(`repair: sanity failed — priced=${priced} cacheKeys=${cacheKeys}`);
  process.exit(1);
}
console.log("repair: pushed origin/data");