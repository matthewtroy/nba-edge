import fs from "fs";
import path from "path";

export const HEADSHOTS_SUBDIR = "headshots";
export const HEADSHOT_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;

export function headshotsDir(dataRoot: string): string {
  return path.join(dataRoot, HEADSHOTS_SUBDIR);
}

export function headshotFilePath(dataRoot: string, playerId: string): string {
  return path.join(headshotsDir(dataRoot), `${playerId}.png`);
}

/** Relative to site `data/` root (no leading slash). */
export function selfHostedHeadshotRelPath(playerId: string): string {
  return `${HEADSHOTS_SUBDIR}/${playerId}.png`;
}

export function selfHostedHeadshotFileExists(dataRoot: string, playerId: string): boolean {
  const p = headshotFilePath(dataRoot, playerId);
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

export function headshotFileAgeMs(dataRoot: string, playerId: string): number | null {
  const p = headshotFilePath(dataRoot, playerId);
  try {
    const st = fs.statSync(p);
    return Date.now() - st.mtimeMs;
  } catch {
    return null;
  }
}

export function listCachedHeadshotIds(dataRoot: string): Set<string> {
  const dir = headshotsDir(dataRoot);
  const out = new Set<string>();
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const m = /^(\d+)\.png$/i.exec(name);
    if (m) out.add(m[1]!);
  }
  return out;
}