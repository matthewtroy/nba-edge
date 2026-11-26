import fs from "fs";
import path from "path";
import { atomicWriteJsonSync, readJsonFile } from "./atomic-json.js";

export interface PlayerTrackingDay {
  playerId: string;
  playerName: string;
  /** Per-game potential assists (L10 window when from NBA). */
  potentialAst?: number;
  potentialReb?: number;
  fgaLast5PerGame?: number;
  fgaSeasonPerGame?: number;
  fgaPerMinL10?: number;
  source: "nba" | "espn";
  cachedAt: string;
}

export interface TrackingCacheFile {
  slateDate: string;
  nbaStatus: "ok" | "blocked";
  players: Record<string, PlayerTrackingDay>;
}

export function trackingCachePath(rootDir: string, slateDate: string): string {
  return path.join(rootDir, "public/data/tracking", `${slateDate}.json`);
}

export function loadTrackingCache(
  rootDir: string,
  slateDate: string
): TrackingCacheFile | null {
  const p = trackingCachePath(rootDir, slateDate);
  if (!fs.existsSync(p)) return null;
  try {
    return readJsonFile<TrackingCacheFile>(p, { slateDate, nbaStatus: "blocked", players: {} });
  } catch {
    throw new Error(`corrupt tracking cache at ${p}`);
  }
}

export function writeTrackingCache(
  rootDir: string,
  file: TrackingCacheFile
): string {
  const p = trackingCachePath(rootDir, file.slateDate);
  atomicWriteJsonSync(p, file);
  return p;
}