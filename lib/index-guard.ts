import fs from "fs";
import path from "path";
import type { DataIndexFile } from "./data-index.js";
import { retentionMinYmd } from "./slate-retention.js";

export function loadDataIndexFile(dataRoot: string): DataIndexFile | null {
  const p = path.join(dataRoot, "index.json");
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as DataIndexFile;
  } catch {
    return null;
  }
}

/** Block runs that would drop a retained slate folder from index.json. */
export function indexRetentionDropReason(
  prior: DataIndexFile | null,
  next: DataIndexFile,
  now: Date
): string | null {
  if (!prior?.dates?.length) return null;
  const min = retentionMinYmd(now);
  const nextDates = new Set(next.dates.map((d) => d.date));
  for (const d of prior.dates) {
    if (d.date >= min && !nextDates.has(d.date)) {
      return `index would drop retained slate ${d.date} (min retention ${min})`;
    }
  }
  return null;
}