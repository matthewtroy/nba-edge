import type { H2hSeasonLogCacheFile, H2hSeasonLogRow } from "./h2h-cache.js";

function modelEspnSeasons(asOf: Date): Set<number> {
  const y = asOf.getUTCFullYear();
  const current = asOf.getUTCMonth() >= 9 ? y + 1 : y;
  return new Set([current, current - 1, current - 2]);
}

/** Union merge: baseline keys preserved; newer `fetchedAt` wins per key. */
export function mergeH2hSeasonCaches(
  baseline: H2hSeasonLogCacheFile,
  updates: H2hSeasonLogCacheFile
): H2hSeasonLogCacheFile {
  const merged: H2hSeasonLogCacheFile = { ...baseline };
  for (const [key, row] of Object.entries(updates)) {
    const prev = merged[key];
    if (!prev) {
      merged[key] = row;
      continue;
    }
    if (fetchedAtMs(row) >= fetchedAtMs(prev)) merged[key] = row;
  }
  return merged;
}

function fetchedAtMs(row: H2hSeasonLogRow): number {
  const t = new Date(row.fetchedAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Drop season rows older than the three ESPN seasons used for H2H modeling. */
export function pruneH2hSeasonCacheBeyondModelWindow(
  cache: H2hSeasonLogCacheFile,
  asOf: Date
): H2hSeasonLogCacheFile {
  const allowed = modelEspnSeasons(asOf);
  const out: H2hSeasonLogCacheFile = {};
  for (const [key, row] of Object.entries(cache)) {
    if (allowed.has(row.season)) out[key] = row;
  }
  return out;
}