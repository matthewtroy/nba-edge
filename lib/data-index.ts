import fs from "fs";
import path from "path";
import type { SlatePublicationStatus } from "./slate-publication.js";
import type { SlateGame } from "./types.js";
import { sydneyDateString } from "./official-card-time.js";
import { nextSydneyPublishIso } from "./index-schedule.js";

export interface DataIndexDateEntry {
  date: string;
  status: SlatePublicationStatus;
  statusLabel: string;
  gameCount: number;
  legCount: number;
  multiCount: number;
  lastUpdated: string;
  /** Earliest game tip ISO — viewer-local Today/Tomorrow mapping */
  firstTipIso?: string;
}

export interface DataIndexGamePreview {
  id: string;
  away: string;
  home: string;
  tipIso: string;
  status: string;
}

export interface DataIndexFile {
  updatedAt: string;
  todayDate: string;
  tomorrowDate: string | null;
  defaultDate: string;
  dates: DataIndexDateEntry[];
  /** Next 21:00 Sydney publish (UTC ISO). */
  nextPublishAt?: string;
  nextSlateDate?: string | null;
  /** Earliest tip on default slate (UTC ISO). */
  firstTipAt?: string | null;
  games?: DataIndexGamePreview[];
}

export function gamePreviewsFromSlate(slate: SlateGame[]): DataIndexGamePreview[] {
  return slate.map((g) => ({
    id: g.id,
    away: g.awayTeam,
    home: g.homeTeam,
    tipIso: g.startTime,
    status: g.status,
  }));
}

export function slateDataDir(outDir: string, date: string): string {
  return path.join(outDir, date);
}

export function defaultSlateDate(
  index: DataIndexFile,
  now = new Date()
): string {
  const today = index.todayDate;
  if (index.dates.some((d) => d.date === today) && !todaySlateComplete(index, today)) {
    return today;
  }
  if (index.tomorrowDate && index.dates.some((d) => d.date === index.tomorrowDate)) {
    return index.tomorrowDate;
  }
  return index.defaultDate;
}

function todaySlateComplete(index: DataIndexFile, today: string): boolean {
  const entry = index.dates.find((d) => d.date === today);
  return entry?.status === "locked_at_tip";
}

export function writeDataIndex(outDir: string, file: DataIndexFile): void {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(file, null, 2));
}

export function buildDataIndex(
  entries: DataIndexDateEntry[],
  now = new Date(),
  opts: { defaultSlate?: SlateGame[] } = {}
): DataIndexFile {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const todayDate = sydneyDateString(now);
  const tomorrowDate =
    sorted.find((d) => d.date > todayDate)?.date ??
    new Date(now.getTime() + 86_400_000).toLocaleDateString("en-CA", {
      timeZone: "Australia/Sydney",
    });
  const hasTomorrow = sorted.some((d) => d.date === tomorrowDate);
  const defaultDate = defaultSlateDate(
    {
      updatedAt: now.toISOString(),
      todayDate,
      tomorrowDate: hasTomorrow ? tomorrowDate : null,
      defaultDate: todayDate,
      dates: sorted,
    },
    now
  );
  const defaultEntry = sorted.find((d) => d.date === defaultDate);
  const firstTipAt = defaultEntry?.firstTipIso ?? null;
  return {
    updatedAt: now.toISOString(),
    todayDate,
    tomorrowDate: hasTomorrow ? tomorrowDate : null,
    defaultDate,
    dates: sorted,
    nextPublishAt: nextSydneyPublishIso(now),
    nextSlateDate: hasTomorrow ? tomorrowDate : null,
    firstTipAt,
    games:
      opts.defaultSlate?.length && defaultDate
        ? gamePreviewsFromSlate(opts.defaultSlate)
        : undefined,
  };
}