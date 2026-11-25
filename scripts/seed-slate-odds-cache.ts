/**
 * Restore per-slate odds snapshots into public/data/odds-cache.json (e.g. from priced picks.json).
 * Usage: tsx scripts/seed-slate-odds-cache.ts 2026-11-26 path/to/picks.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { OddsCacheFile } from "../lib/odds-cache-file.js";
import type { PickLeg } from "../lib/types.js";
import { slateOddsSnapshotFromPicks } from "./load-from-live-odds.js";
import { cacheSlateOddsSnapshot } from "../lib/odds-slate-cache.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const slateDate = process.argv[2];
const picksPath = process.argv[3];
if (!slateDate || !picksPath) {
  console.error("Usage: tsx scripts/seed-slate-odds-cache.ts <slate-date> <picks.json>");
  process.exit(1);
}

const cachePath = path.join(rootDir, "public/data/odds-cache.json");
const cache: OddsCacheFile = fs.existsSync(cachePath)
  ? (JSON.parse(fs.readFileSync(cachePath, "utf8")) as OddsCacheFile)
  : {};
const picks = JSON.parse(fs.readFileSync(picksPath, "utf8")) as PickLeg[];
const pulledAt = cache.lastPulled ?? new Date().toISOString();
const snap = slateOddsSnapshotFromPicks(picks, pulledAt);
cacheSlateOddsSnapshot(cache, slateDate, snap);
if (!cache.oddsMap) cache.oddsMap = {};
for (const [k, v] of Object.entries(snap.oddsMap)) cache.oddsMap[k] = v;
if (!cache.lastPulled) cache.lastPulled = pulledAt;

fs.mkdirSync(path.dirname(cachePath), { recursive: true });
fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
const priced = picks.filter((p) => (p.bestPrice ?? 0) > 1).length;
console.log(
  `seed-slate-odds-cache: ${slateDate} · ${priced} priced legs · ${Object.keys(snap.oddsMap).length} keys in snapshot`
);