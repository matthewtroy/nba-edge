import fs from "fs";
import path from "path";
import type { OfficialCardFile } from "./official-card-time.js";
import type { MultiBet, PickLeg } from "./types.js";
import { espnHeadshotUrl } from "./player-headshot.js";
import {
  HEADSHOT_MAX_AGE_MS,
  headshotFilePath,
  headshotsDir,
  selfHostedHeadshotFileExists,
  selfHostedHeadshotRelPath,
} from "./headshot-store.js";

export const HEADSHOT_DOWNLOAD_CONCURRENCY = 6;
export const HEADSHOT_DOWNLOAD_TIMEOUT_MS = 12_000;

/** ESPN CDN combiner ~128px (pipeline download source). */
export function espnHeadshotDownloadUrl(playerId: string): string {
  const id = playerId.trim();
  const img = encodeURIComponent(`/i/headshots/nba/players/full/${id}.png`);
  return `https://a.espncdn.com/combiner/i?img=${img}&w=128&h=128`;
}

export function resolveStoredHeadshotUrl(
  dataRoot: string,
  playerId: string,
  espnFallback?: string
): string {
  if (selfHostedHeadshotFileExists(dataRoot, playerId)) {
    return selfHostedHeadshotRelPath(playerId);
  }
  const fb = espnFallback?.trim();
  if (fb) return fb;
  return espnHeadshotUrl(playerId);
}

export function collectPlayerIdsFromPublishedSlates(
  dataRoot: string,
  slateDates: string[]
): Set<string> {
  const ids = new Set<string>();
  const addFromPicks = (picks: PickLeg[]) => {
    for (const p of picks) {
      if (p.playerId?.trim()) ids.add(p.playerId.trim());
    }
  };
  const addFromCard = (card: OfficialCardFile | null) => {
    if (!card?.legSnapshots) return;
    for (const snap of Object.values(card.legSnapshots)) {
      if (snap.playerId?.trim()) ids.add(snap.playerId.trim());
    }
    if (card.multis?.length) {
      for (const multi of card.multis as MultiBet[]) {
        for (const legId of multi.legs) {
          const snap = card.legSnapshots?.[legId];
          if (snap?.playerId?.trim()) ids.add(snap.playerId.trim());
        }
      }
    }
  };
  for (const ymd of slateDates) {
    const dir = path.join(dataRoot, ymd);
    const picksPath = path.join(dir, "picks.json");
    if (fs.existsSync(picksPath)) {
      try {
        addFromPicks(JSON.parse(fs.readFileSync(picksPath, "utf8")) as PickLeg[]);
      } catch {
        /* skip */
      }
    }
    const cardPath = path.join(dir, "official-card.json");
    if (fs.existsSync(cardPath)) {
      try {
        addFromCard(JSON.parse(fs.readFileSync(cardPath, "utf8")) as OfficialCardFile);
      } catch {
        /* skip */
      }
    }
  }
  return ids;
}

export type HeadshotDownloadResult = {
  downloaded: number;
  skipped: number;
  failed: number;
  totalBytes: number;
};

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function downloadHeadshotsForPlayers(
  dataRoot: string,
  playerIds: Iterable<string>,
  opts: { now?: Date } = {}
): Promise<HeadshotDownloadResult> {
  const now = opts.now ?? new Date();
  const dir = headshotsDir(dataRoot);
  fs.mkdirSync(dir, { recursive: true });
  const ids = [...new Set([...playerIds].map((id) => id.trim()).filter(Boolean))];
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  let totalBytes = 0;

  await mapPoolHeadshots(ids, HEADSHOT_DOWNLOAD_CONCURRENCY, async (playerId) => {
    const dest = headshotFilePath(dataRoot, playerId);
    try {
      const ageMs = fs.existsSync(dest) ? now.getTime() - fs.statSync(dest).mtimeMs : null;
      if (ageMs != null && ageMs < HEADSHOT_MAX_AGE_MS) {
        skipped += 1;
        return;
      }
      const url = espnHeadshotDownloadUrl(playerId);
      const res = await fetchWithTimeout(url, HEADSHOT_DOWNLOAD_TIMEOUT_MS);
      if (!res.ok) {
        failed += 1;
        console.warn(`headshots: skip ${playerId} HTTP ${res.status}`);
        return;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 200) {
        failed += 1;
        console.warn(`headshots: skip ${playerId} tiny response (${buf.length} B)`);
        return;
      }
      fs.writeFileSync(dest, buf);
      downloaded += 1;
      totalBytes += buf.length;
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`headshots: skip ${playerId} — ${msg}`);
    }
  });

  return { downloaded, skipped, failed, totalBytes };
}

async function mapPoolHeadshots<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
}

export function applyHeadshotUrlsToSlatePicks(dataRoot: string, slateDates: string[]): number {
  let updated = 0;
  for (const ymd of slateDates) {
    const picksPath = path.join(dataRoot, ymd, "picks.json");
    if (!fs.existsSync(picksPath)) continue;
    let picks: PickLeg[];
    try {
      picks = JSON.parse(fs.readFileSync(picksPath, "utf8")) as PickLeg[];
    } catch {
      continue;
    }
    let changed = false;
    const next = picks.map((leg) => {
      const url = resolveStoredHeadshotUrl(dataRoot, leg.playerId, leg.headshotUrl);
      if (url !== leg.headshotUrl) {
        changed = true;
        updated += 1;
        return { ...leg, headshotUrl: url };
      }
      return leg;
    });
    if (changed) {
      fs.writeFileSync(picksPath, JSON.stringify(next, null, 2));
    }
  }
  return updated;
}