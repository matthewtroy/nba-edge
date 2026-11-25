import fs from "fs";
import path from "path";
import type { PlayerGameLog } from "./types.js";
import { parseGameLogsFromEspn } from "../scripts/espn-parse.js";

export interface CachedGameLog {
  fetchedAt: string;
  headshot: string;
  logs: PlayerGameLog[];
}

export type GameLogCacheFile = Record<string, CachedGameLog>;

const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function gameLogCachePath(outDir: string): string {
  return path.join(outDir, "game-log-cache.json");
}

export function loadGameLogCache(outDir: string): GameLogCacheFile {
  const p = gameLogCachePath(outDir);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as GameLogCacheFile;
  } catch {
    return {};
  }
}

export function saveGameLogCache(outDir: string, cache: GameLogCacheFile): void {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(gameLogCachePath(outDir), JSON.stringify(cache, null, 2));
}

export function getCachedLogs(
  cache: GameLogCacheFile,
  athleteId: string,
  now: Date
): PlayerGameLog[] | undefined {
  const row = cache[athleteId];
  if (!row) return undefined;
  const age = now.getTime() - new Date(row.fetchedAt).getTime();
  if (age > MAX_AGE_MS) return undefined;
  return row.logs;
}

export function cacheLogsFromRaw(
  cache: GameLogCacheFile,
  athleteId: string,
  logRaw: unknown,
  headshot: string,
  now: Date
): PlayerGameLog[] {
  const logs = parseGameLogsFromEspn(logRaw, headshot);
  cache[athleteId] = { fetchedAt: now.toISOString(), headshot, logs };
  return logs;
}