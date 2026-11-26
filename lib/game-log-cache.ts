import fs from "fs";
import path from "path";
import type { PlayerGameLog } from "./types.js";
import { parseGameLogsFromEspn } from "../scripts/espn-parse.js";
import {
  modelRatesLogCount,
  normalizeLogsForPlayer,
  stampLegacyLogSources,
} from "./game-log-normalize.js";

export { modelRatesLogCount, normalizeLogsForPlayer, stampLegacyLogSources } from "./game-log-normalize.js";

/** Bump when ESPN parse mapping changes (invalidates stale cached rows). */
export const GAME_LOG_CACHE_VERSION = 3;

export interface CachedGameLog {
  fetchedAt: string;
  headshot: string;
  logs: PlayerGameLog[];
  version?: number;
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
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as GameLogCacheFile;
    for (const row of Object.values(raw)) {
      row.logs = stampLegacyLogSources(row.logs);
    }
    return raw;
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
  if ((row.version ?? 1) < GAME_LOG_CACHE_VERSION) return undefined;
  const age = now.getTime() - new Date(row.fetchedAt).getTime();
  if (age > MAX_AGE_MS) return undefined;
  const logs = normalizeLogsForPlayer(row.logs);
  if (modelRatesLogCount(logs) < 3) return undefined;
  return logs;
}

export function cacheLogsFromRaw(
  cache: GameLogCacheFile,
  athleteId: string,
  logRaw: unknown,
  headshot: string,
  now: Date,
  playerTeamId?: string
): PlayerGameLog[] {
  const logs = parseGameLogsFromEspn(logRaw, headshot, playerTeamId).map((g) => ({
    ...g,
    source: "espn" as const,
  }));
  cache[athleteId] = {
    fetchedAt: now.toISOString(),
    headshot,
    logs,
    version: GAME_LOG_CACHE_VERSION,
  };
  return logs;
}