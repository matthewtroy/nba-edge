import fs from "fs";
import path from "path";
import type { SlatePublicationStatus } from "./slate-publication.js";
import { sydneyDateString } from "./official-card-time.js";

export interface SlateIndexEntry {
  tipDate: string;
  gameCount: number;
  mode?: "auto" | "next";
  dir?: string;
  publishedAt?: string;
  status?: SlatePublicationStatus;
}

export interface SlateIndexFile {
  defaultDate: string;
  updatedAt: string;
  slates: SlateIndexEntry[];
}

export function defaultDateForIndex(
  entries: SlateIndexEntry[],
  now = new Date()
): string {
  if (!entries.length) return sydneyDateString(now);
  const today = sydneyDateString(now);
  if (entries.some((e) => e.tipDate === today)) return today;
  const dates = [...new Set(entries.map((e) => e.tipDate))].sort();
  const future = dates.find((d) => d >= today);
  return future ?? dates[dates.length - 1]!;
}

export function writeSlateIndex(
  outDir: string,
  entries: SlateIndexEntry[],
  now = new Date()
): SlateIndexFile {
  const file: SlateIndexFile = {
    defaultDate: defaultDateForIndex(entries, now),
    updatedAt: now.toISOString(),
    slates: [...entries].sort((a, b) => a.tipDate.localeCompare(b.tipDate)),
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "slate-index.json"),
    JSON.stringify(file, null, 2)
  );
  return file;
}