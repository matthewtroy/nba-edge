import type { ModelPlayer } from "../scripts/model-engine.js";
import {
  type TrackingCacheFile,
  loadTrackingCache,
  writeTrackingCache,
} from "./player-tracking-cache.js";

function espnRow(p: ModelPlayer) {
  const sorted = [...p.gameLogs].sort((a, b) => b.date.localeCompare(a.date));
  const l10 = sorted.slice(0, 10);
  let fga = 0;
  let mins = 0;
  for (const g of l10.slice(0, 5)) {
    fga += g.fga ?? 0;
    mins += g.minutes;
  }
  return {
    playerId: p.id,
    playerName: p.name,
    fgaPerMinL10: mins > 0 ? fga / mins : undefined,
    source: "espn" as const,
    cachedAt: new Date().toISOString(),
  };
}

/** Sync ESPN stand-in cache (when NBA blocked or offline). */
export function buildEspnTrackingCache(
  rootDir: string,
  slateDate: string,
  players: ModelPlayer[]
): TrackingCacheFile {
  const file: TrackingCacheFile = {
    slateDate,
    nbaStatus: "blocked",
    players: {},
  };
  for (const p of players) {
    file.players[p.id] = espnRow(p);
  }
  writeTrackingCache(rootDir, file);
  return file;
}

export function ensureTrackingCacheLoaded(
  rootDir: string,
  slateDate: string,
  players: ModelPlayer[]
): TrackingCacheFile {
  const existing = loadTrackingCache(rootDir, slateDate);
  if (existing) return existing;
  return buildEspnTrackingCache(rootDir, slateDate, players);
}