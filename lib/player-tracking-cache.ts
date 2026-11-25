import fs from "fs";
import path from "path";

export interface PlayerTrackingDay {
  playerId: string;
  playerName: string;
  /** Per-game potential assists (L10 window when from NBA). */
  potentialAst?: number;
  potentialReb?: number;
  /** ESPN proxy: FGA per minute L10 */
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
  return JSON.parse(fs.readFileSync(p, "utf8")) as TrackingCacheFile;
}

export function writeTrackingCache(
  rootDir: string,
  file: TrackingCacheFile
): string {
  const p = trackingCachePath(rootDir, file.slateDate);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(file, null, 2));
  return p;
}