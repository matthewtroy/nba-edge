import fs from "fs";
import path from "path";
import { retentionMinYmd } from "./slate-retention.js";
import {
  listAllSlateFoldersOnDataRef,
  resolveDataGitRef,
} from "./restore-data-branch.js";

const SLATE_DIR_RE = /^\d{4}-\d{2}-\d{2}$/;

function listLocalSlateFolders(dataRoot: string): string[] {
  if (!fs.existsSync(dataRoot)) return [];
  return fs
    .readdirSync(dataRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && SLATE_DIR_RE.test(d.name))
    .map((d) => d.name)
    .sort();
}

function slateHasSettleArtifact(dataRoot: string, ymd: string): boolean {
  const dir = path.join(dataRoot, ymd);
  return (
    fs.existsSync(path.join(dir, "results.json")) ||
    fs.existsSync(path.join(dir, "picks.json")) ||
    fs.existsSync(path.join(dir, "official-card.json"))
  );
}

/** All slate dates that contribute to cumulative results (data branch + disk). */
export function listSettleSlateDates(rootDir: string, dataRoot: string, now: Date): string[] {
  const dates = new Set<string>();
  const dataRef = resolveDataGitRef(rootDir);
  if (dataRef) {
    for (const ymd of listAllSlateFoldersOnDataRef(rootDir, dataRef)) {
      dates.add(ymd);
    }
  }
  for (const ymd of listLocalSlateFolders(dataRoot)) {
    if (slateHasSettleArtifact(dataRoot, ymd)) dates.add(ymd);
  }
  return [...dates].sort();
}

/** Slates eligible for live re-grade (inside Sydney retention window). */
export function listRegradeSlateDates(
  slateDates: string[],
  now: Date,
  isFrozen: (ymd: string) => boolean
): string[] {
  const min = retentionMinYmd(now);
  return slateDates.filter((d) => d >= min && !isFrozen(d));
}