import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import type { DataIndexFile } from "./data-index.js";
import { retentionMinYmd } from "./slate-retention.js";
import {
  listSlateFoldersOnDataRef,
  resolveDataGitRef,
} from "./restore-data-branch.js";

export function loadDataIndexFile(dataRoot: string): DataIndexFile | null {
  const p = path.join(dataRoot, "index.json");
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as DataIndexFile;
  } catch {
    return null;
  }
}

function dataRefResolvable(rootDir: string, ref: string): boolean {
  try {
    execFileSync("git", ["rev-parse", "--verify", ref], {
      cwd: rootDir,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

/** Retained `YYYY-MM-DD` slate folders on origin/data (ls-tree), not index rows. */
export function listDataBranchRetainedFolders(rootDir: string, now: Date): string[] {
  const ref =
    resolveDataGitRef(rootDir) ??
    (dataRefResolvable(rootDir, "refs/remotes/origin/data")
      ? "refs/remotes/origin/data"
      : null);
  if (!ref) return [];
  return listSlateFoldersOnDataRef(rootDir, ref, now);
}

/** Block runs that would drop a retained slate folder from index.json. */
export function indexRetentionDropReason(
  prior: DataIndexFile | null,
  next: DataIndexFile,
  now: Date,
  opts: { dataBranchFolders?: string[] } = {}
): string | null {
  const min = retentionMinYmd(now);
  const nextDates = new Set(next.dates.map((d) => d.date));
  const retained = new Set<string>();
  for (const d of opts.dataBranchFolders ?? []) {
    if (d >= min) retained.add(d);
  }
  for (const d of prior?.dates ?? []) {
    if (d.date >= min) retained.add(d.date);
  }
  for (const d of retained) {
    if (!nextDates.has(d)) {
      return `index would drop retained slate ${d} (min retention ${min})`;
    }
  }
  return null;
}