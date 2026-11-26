import fs from "fs";
import path from "path";
import type { SlateGame } from "./types.js";
import type { MetaJson } from "./types.js";
import type { DataIndexDateEntry } from "./data-index.js";
import { sydneyDateString } from "./official-card-time.js";
import {
  filterOpenGamesOnSydneyDate,
  filterSlateToTodaySydney,
  sydneyTipDate,
  tomorrowSydneyDateString,
} from "./slate-today.js";
import { computeSlateStatus } from "./slate-publication.js";
import type { OfficialCardFile } from "./official-card-time.js";

const SLATE_FOLDER_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Retain slates through Sydney yesterday (today − 1). */
export function retentionMinYmd(now: Date): string {
  const today = sydneyDateString(now);
  const anchor = new Date(`${today}T12:00:00.000Z`);
  const prev = new Date(anchor.getTime() - 86_400_000);
  return prev.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
}

export function pipelineSydneyDates(now: Date): { todayYmd: string; tomorrowYmd: string } {
  return {
    todayYmd: sydneyDateString(now),
    tomorrowYmd: tomorrowSydneyDateString(now),
  };
}

export function gamesOnSydneyDate(games: SlateGame[], ymd: string): SlateGame[] {
  return games.filter((g) => sydneyTipDate(g.startTime) === ymd);
}

/** Sydney calendar today (incl. finals) + tomorrow open games — not US scoreboard day. */
export function planScoreboardSlates(
  merged: SlateGame[],
  now: Date
): { today: SlateGame[]; tomorrow: SlateGame[] } {
  const { todayYmd, tomorrowYmd } = pipelineSydneyDates(now);
  let today = gamesOnSydneyDate(merged, todayYmd);
  if (!today.length) {
    const legacy = filterSlateToTodaySydney(merged, now);
    if (legacy.length && sydneyTipDate(legacy[0]!.startTime) === todayYmd) {
      today = legacy;
    }
  }
  let tomorrow = filterOpenGamesOnSydneyDate(merged, tomorrowYmd);
  const todayIds = new Set(today.map((g) => g.id));
  tomorrow = tomorrow.filter((g) => !todayIds.has(g.id));
  return { today, tomorrow };
}

export function slatesToPublishFromPlan(
  today: SlateGame[],
  tomorrow: SlateGame[]
): SlateGame[][] {
  const out: SlateGame[][] = [];
  if (today.length) out.push(today);
  if (tomorrow.length) out.push(tomorrow);
  return out;
}

export function listRetainedSlateFolders(dataRoot: string, now: Date): string[] {
  const min = retentionMinYmd(now);
  if (!fs.existsSync(dataRoot)) return [];
  return fs
    .readdirSync(dataRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && SLATE_FOLDER_RE.test(d.name) && d.name >= min)
    .map((d) => d.name)
    .sort();
}

export function loadPersistedSlate(dataRoot: string, ymd: string): SlateGame[] {
  const p = path.join(dataRoot, ymd, "slate.json");
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as SlateGame[];
  } catch {
    return [];
  }
}

/** When the US scoreboard is empty (e.g. ET Thanksgiving), keep publishing from persisted slates. */
export function mergePlanWithPersisted(
  plan: { today: SlateGame[]; tomorrow: SlateGame[] },
  dataRoot: string,
  now: Date
): { today: SlateGame[]; tomorrow: SlateGame[] } {
  const { todayYmd, tomorrowYmd } = pipelineSydneyDates(now);
  const today =
    plan.today.length > 0 ? plan.today : loadPersistedSlate(dataRoot, todayYmd);
  const tomorrow =
    plan.tomorrow.length > 0 ? plan.tomorrow : loadPersistedSlate(dataRoot, tomorrowYmd);
  return { today, tomorrow };
}

export function indexEntryFromSlateDir(
  dataRoot: string,
  ymd: string,
  now: Date
): DataIndexDateEntry | null {
  const dir = path.join(dataRoot, ymd);
  const slatePath = path.join(dir, "slate.json");
  const metaPath = path.join(dir, "meta.json");
  if (!fs.existsSync(slatePath) || !fs.existsSync(metaPath)) return null;
  try {
    const slate = JSON.parse(fs.readFileSync(slatePath, "utf8")) as SlateGame[];
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as MetaJson;
    let legCount = 0;
    let multiCount = 0;
    const picksPath = path.join(dir, "picks.json");
    const multisPath = path.join(dir, "multis.json");
    if (fs.existsSync(picksPath)) {
      legCount = (JSON.parse(fs.readFileSync(picksPath, "utf8")) as unknown[]).length;
    }
    if (fs.existsSync(multisPath)) {
      const raw = JSON.parse(fs.readFileSync(multisPath, "utf8")) as
        | unknown[]
        | { bets?: unknown[] };
      multiCount = Array.isArray(raw) ? raw.length : (raw.bets?.length ?? 0);
    }
    let official: OfficialCardFile | null = null;
    const officialPath = path.join(dir, "official-card.json");
    if (fs.existsSync(officialPath)) {
      try {
        official = JSON.parse(fs.readFileSync(officialPath, "utf8")) as OfficialCardFile;
      } catch {
        official = null;
      }
    }
    const { status, statusLabel } = computeSlateStatus(slate, meta, official, now);
    const tips = slate
      .map((g) => new Date(g.startTime).getTime())
      .filter(Number.isFinite);
    const firstTipMs = tips.length ? Math.min(...tips) : NaN;
    const firstTipIso = Number.isFinite(firstTipMs)
      ? new Date(firstTipMs).toISOString()
      : undefined;
    return {
      date: ymd,
      status,
      statusLabel,
      gameCount: slate.length,
      legCount,
      multiCount,
      lastUpdated: meta.lastUpdated,
      firstTipIso,
    };
  } catch {
    return null;
  }
}

export function mergeRetainedIndexEntries(
  built: DataIndexDateEntry[],
  dataRoot: string,
  now: Date
): DataIndexDateEntry[] {
  const min = retentionMinYmd(now);
  const byDate = new Map<string, DataIndexDateEntry>();
  for (const ymd of listRetainedSlateFolders(dataRoot, now)) {
    const e = indexEntryFromSlateDir(dataRoot, ymd, now);
    if (e) byDate.set(ymd, e);
  }
  for (const e of built) {
    if (e.date >= min) byDate.set(e.date, e);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}