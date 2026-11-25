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