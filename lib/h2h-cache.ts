import fs from "fs";
import path from "path";

export interface H2hMeetingSummary {
  playerId: string;
  opponentTeamId: string;
  meetings: number;
  /** ISO dates, newest first */
  dates: string[];
  ptsAvg: number;
  rebAvg: number;
  astAvg: number;
  threesAvg: number;
  cachedAt: string;
}

export type H2hCacheFile = Record<string, H2hMeetingSummary>;

function cacheKey(playerId: string, opponentTeamId: string): string {
  return `${playerId}:${opponentTeamId}`;
}

export function h2hCachePath(rootDir: string): string {
  return path.join(rootDir, "public/data/h2h-cache.json");
}

export function loadH2hCache(rootDir: string): H2hCacheFile {
  const p = h2hCachePath(rootDir);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as H2hCacheFile;
  } catch {
    return {};
  }
}

export function saveH2hCache(rootDir: string, file: H2hCacheFile): void {
  const p = h2hCachePath(rootDir);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(file, null, 2));
}

export function getH2hCached(
  cache: H2hCacheFile,
  playerId: string,
  opponentTeamId: string
): H2hMeetingSummary | undefined {
  return cache[cacheKey(playerId, opponentTeamId)];
}

export function putH2hCached(
  cache: H2hCacheFile,
  summary: H2hMeetingSummary
): void {
  cache[cacheKey(summary.playerId, summary.opponentTeamId)] = summary;
}

export interface H2hSeasonLogRow {
  playerId: string;
  season: number;
  fetchedAt: string;
  logs: import("./types.js").PlayerGameLog[];
}

export type H2hSeasonLogCacheFile = Record<string, H2hSeasonLogRow>;

function seasonCacheKey(playerId: string, season: number): string {
  return `${playerId}:${season}`;
}

/** `dataDir` is usually `public/data` (same as game-log cache). */
export function h2hSeasonCachePath(dataDir: string): string {
  return path.join(dataDir, "h2h-season-cache.json");
}

export function loadH2hSeasonCache(rootDir: string): H2hSeasonLogCacheFile {
  const p = h2hSeasonCachePath(rootDir);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as H2hSeasonLogCacheFile;
  } catch {
    return {};
  }
}

export function saveH2hSeasonCache(rootDir: string, file: H2hSeasonLogCacheFile): void {
  const p = h2hSeasonCachePath(rootDir);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(file, null, 2));
}

export function getH2hSeasonCached(
  cache: H2hSeasonLogCacheFile,
  playerId: string,
  season: number
): H2hSeasonLogRow | undefined {
  return cache[seasonCacheKey(playerId, season)];
}

export function putH2hSeasonCached(cache: H2hSeasonLogCacheFile, row: H2hSeasonLogRow): void {
  cache[seasonCacheKey(row.playerId, row.season)] = row;
}