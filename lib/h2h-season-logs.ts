import type { PlayerGameLog } from "./types.js";
import { fetchPlayerGameLog } from "../scripts/fetch/espn.js";
import { parseGameLogsFromEspn } from "../scripts/espn-parse.js";
import {
  getH2hSeasonCached,
  loadH2hSeasonCache,
  putH2hSeasonCached,
  saveH2hSeasonCache,
  type H2hSeasonLogCacheFile,
} from "./h2h-cache.js";
import { filterH2hLogs } from "./h2h-reason.js";

const SEASON_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

/** ESPN `season` query param (end year): Oct–Dec uses Y+1, else Y. */
export function espnSeasonYearsForH2h(asOf: Date): [number, number, number] {
  const y = asOf.getUTCFullYear();
  const current = asOf.getUTCMonth() >= 9 ? y + 1 : y;
  return [current, current - 1, current - 2];
}

function mergeLogsByGameId(chunks: PlayerGameLog[][]): PlayerGameLog[] {
  const byId = new Map<string, PlayerGameLog>();
  for (const chunk of chunks) {
    for (const g of chunk) {
      const prev = byId.get(g.gameId);
      if (!prev || g.minutes >= prev.minutes) byId.set(g.gameId, g);
    }
  }
  return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export async function fetchEspnSeasonLogs(
  athleteId: string,
  season: number
): Promise<PlayerGameLog[]> {
  const raw = await fetchPlayerGameLog(athleteId, season);
  return parseGameLogsFromEspn(raw, "").map((g) => ({ ...g, source: "espn" as const }));
}

export async function ensureH2hSeasonLogs(opts: {
  rootDir: string;
  playerId: string;
  asOf: Date;
  fetchMissing?: boolean;
  /** Shared in-memory cache (no per-call load/save; caller persists once). */
  cache?: H2hSeasonLogCacheFile;
  persist?: boolean;
}): Promise<PlayerGameLog[]> {
  const { rootDir, playerId, asOf, fetchMissing = true } = opts;
  const ownsCache = opts.cache === undefined;
  const cache = opts.cache ?? loadH2hSeasonCache(rootDir);
  const shouldPersist = opts.persist ?? ownsCache;
  const seasons = espnSeasonYearsForH2h(asOf);
  const chunks: PlayerGameLog[][] = [];
  let dirty = false;

  for (const season of seasons) {
    let row = getH2hSeasonCached(cache, playerId, season);
    const stale =
      !row || asOf.getTime() - new Date(row.fetchedAt).getTime() > SEASON_CACHE_MS;
    if (stale && fetchMissing) {
      try {
        const logs = await fetchEspnSeasonLogs(playerId, season);
        row = { playerId, season, fetchedAt: asOf.toISOString(), logs };
        putH2hSeasonCached(cache, row);
        dirty = true;
      } catch {
        if (row) chunks.push(row.logs);
        continue;
      }
    }
    if (row?.logs?.length) chunks.push(row.logs);
  }

  if (dirty && shouldPersist) saveH2hSeasonCache(rootDir, cache);
  return mergeLogsByGameId(chunks);
}

export function h2hMeetingsPerEspnSeason(
  logs: PlayerGameLog[],
  opponentTeamId: string,
  opponentName: string | undefined,
  asOf: Date
): Record<number, number> {
  const seasons = espnSeasonYearsForH2h(asOf);
  const out: Record<number, number> = {};
  for (const season of seasons) {
    const floor = `${season - 1}-10-01`;
    const ceil = `${season}-09-30`;
    const slice = logs.filter((g) => {
      const d = g.date.slice(0, 10);
      return d >= floor && d <= ceil;
    });
    out[season] = filterH2hLogs(slice, opponentTeamId, opponentName).length;
  }
  return out;
}

export function loadH2hLogsFromCache(
  rootDir: string,
  playerId: string,
  asOf: Date
): PlayerGameLog[] {
  const seasons = espnSeasonYearsForH2h(asOf);
  const cache: H2hSeasonLogCacheFile = loadH2hSeasonCache(rootDir);
  const chunks: PlayerGameLog[][] = [];
  for (const season of seasons) {
    const row = getH2hSeasonCached(cache, playerId, season);
    if (row?.logs?.length) chunks.push(row.logs);
  }
  return mergeLogsByGameId(chunks);
}