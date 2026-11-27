import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import type { InjuryEntry, InjuryStatus } from "./types.js";
import { injuriesByPlayerId } from "./player-eligibility.js";
import { injuryEntryRecencyMs } from "./injury-report-time.js";
import { resolveDataGitRef } from "./restore-data-branch.js";
import { SLATE_FOLDER_PATTERN } from "./slate-retention.js";
import type { InjuryStatusChange, InjuryStatusHistoryFile } from "./injury-status-history-ui.js";

export type { InjuryStatusChange, InjuryStatusHistoryFile } from "./injury-status-history-ui.js";
export {
  INJURY_STATUS_TRANSITION_WINDOW_MS,
  injuryStatusHealthyForTransition,
  recentActiveStatusTransition,
} from "./injury-status-history-ui.js";

import { INJURY_STATUS_HISTORY_FILE } from "./injury-status-history-ui.js";

export { INJURY_STATUS_HISTORY_FILE } from "./injury-status-history-ui.js";
export const INJURY_STATUS_HISTORY_REL = `public/data/${INJURY_STATUS_HISTORY_FILE}`;

export const INJURY_STATUS_HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const INJURY_STATUS_HISTORY_BACKFILL_DAYS = 3;

export function emptyInjuryStatusHistory(): InjuryStatusHistoryFile {
  return { version: 1, changes: [] };
}

export function loadInjuryStatusHistoryFile(filePath: string): InjuryStatusHistoryFile {
  if (!fs.existsSync(filePath)) return emptyInjuryStatusHistory();
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as InjuryStatusHistoryFile;
    if (raw?.version === 1 && Array.isArray(raw.changes)) return raw;
  } catch {
    /* corrupt */
  }
  return emptyInjuryStatusHistory();
}

export function writeInjuryStatusHistoryFile(
  filePath: string,
  file: InjuryStatusHistoryFile
): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(file, null, 2)}\n`);
}

export function injuryStatusHistoryEntryCount(
  file: InjuryStatusHistoryFile | null | undefined
): number {
  if (!file || !Array.isArray(file.changes)) {
    console.warn("injuryStatusHistoryEntryCount: unexpected shape — treating as 0 entries");
    return 0;
  }
  return file.changes.length;
}

function changeKey(c: InjuryStatusChange): string {
  return `${c.playerId}:${c.slateDate}:${c.fromStatus}:${c.toStatus}:${c.observedAt.slice(0, 16)}`;
}

function observedAtForEntry(entry: InjuryEntry, fallbackIso: string): string {
  const ms = injuryEntryRecencyMs(entry);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : fallbackIso;
}

/** Append status transitions when a slate `injuries.json` is written. */
export function recordInjuryStatusChanges(
  history: InjuryStatusHistoryFile,
  opts: {
    slateDate: string;
    previous: InjuryEntry[];
    next: InjuryEntry[];
    observedAt: string;
  }
): InjuryStatusHistoryFile {
  const prevMap = injuriesByPlayerId(opts.previous);
  const nextMap = injuriesByPlayerId(opts.next);
  const seen = new Set(history.changes.map(changeKey));
  const additions: InjuryStatusChange[] = [];

  for (const [playerId, entry] of nextMap) {
    const prev = prevMap.get(playerId);
    const fromStatus: InjuryStatus = prev?.status ?? "Available";
    const toStatus = entry.status;
    if (fromStatus === toStatus) continue;
    const row: InjuryStatusChange = {
      playerId,
      playerName: entry.playerName,
      teamId: entry.teamId,
      gameId: entry.gameId,
      slateDate: opts.slateDate,
      fromStatus,
      toStatus,
      observedAt: observedAtForEntry(entry, opts.observedAt),
      source: entry.source,
    };
    const key = changeKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    additions.push(row);
  }

  if (!additions.length) return history;
  return {
    version: 1,
    changes: [...history.changes, ...additions],
  };
}

export function pruneInjuryStatusHistory(
  history: InjuryStatusHistoryFile,
  now: Date
): InjuryStatusHistoryFile {
  const minMs = now.getTime() - INJURY_STATUS_HISTORY_RETENTION_MS;
  const changes = history.changes.filter((c) => Date.parse(c.observedAt) >= minMs);
  if (changes.length === history.changes.length) return history;
  return { version: 1, changes };
}

export function mergeInjuryStatusHistory(
  base: InjuryStatusHistoryFile,
  incoming: InjuryStatusHistoryFile
): InjuryStatusHistoryFile {
  const seen = new Set(base.changes.map(changeKey));
  const merged = [...base.changes];
  for (const c of incoming.changes) {
    const key = changeKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(c);
  }
  merged.sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  return { version: 1, changes: merged };
}

function gitShowJson<T>(rootDir: string, dataRef: string, relPath: string): T | null {
  try {
    const raw = execFileSync("git", ["show", `${dataRef}:${relPath}`], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 32 * 1024 * 1024,
    });
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function gitLogInjuryCommits(
  rootDir: string,
  dataRef: string,
  relPath: string,
  sinceIso: string
): string[] {
  try {
    const raw = execFileSync(
      "git",
      [
        "log",
        dataRef,
        `--since=${sinceIso}`,
        "--format=%H",
        "--",
        relPath,
      ],
      { cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    return raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function listSlateInjuryPathsOnRef(rootDir: string, dataRef: string): string[] {
  try {
    const raw = execFileSync(
      "git",
      ["ls-tree", "-r", "--name-only", dataRef, "public/data"],
      { cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    return raw
      .split("\n")
      .map((l) => l.trim())
      .filter((p) => /\/injuries\.json$/.test(p))
      .filter((p) => SLATE_FOLDER_PATTERN.test(p.split("/")[2] ?? ""));
  } catch {
    return [];
  }
}

/** Rebuild recent changes from data-branch `injuries.json` git history (default 3 days). */
export function backfillInjuryStatusHistoryFromDataBranch(
  rootDir: string,
  now: Date,
  daysBack = INJURY_STATUS_HISTORY_BACKFILL_DAYS
): InjuryStatusHistoryFile {
  const dataRef = resolveDataGitRef(rootDir);
  if (!dataRef) return emptyInjuryStatusHistory();

  const since = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString();
  const paths = listSlateInjuryPathsOnRef(rootDir, dataRef);
  let history = emptyInjuryStatusHistory();

  for (const relPath of paths) {
    const slateDate = relPath.split("/")[2] ?? "";
    if (!slateDate) continue;
    const commits = gitLogInjuryCommits(rootDir, dataRef, relPath, sinceIso);
    if (commits.length < 2) continue;
    const ordered = [...commits].reverse();
    let prev = gitShowJson<InjuryEntry[]>(rootDir, ordered[0]!, relPath) ?? [];
    for (let i = 1; i < ordered.length; i++) {
      const next = gitShowJson<InjuryEntry[]>(rootDir, ordered[i]!, relPath) ?? [];
      history = recordInjuryStatusChanges(history, {
        slateDate,
        previous: prev,
        next,
        observedAt: new Date(now.getTime()).toISOString(),
      });
      prev = next;
    }
  }
  return pruneInjuryStatusHistory(history, now);
}

export function refreshInjuryStatusHistoryFile(
  rootDir: string,
  now: Date
): InjuryStatusHistoryFile {
  const filePath = path.join(rootDir, "public/data", INJURY_STATUS_HISTORY_FILE);
  const onDisk = loadInjuryStatusHistoryFile(filePath);
  const backfilled = backfillInjuryStatusHistoryFromDataBranch(rootDir, now);
  let merged = mergeInjuryStatusHistory(onDisk, backfilled);
  merged = pruneInjuryStatusHistory(merged, now);
  writeInjuryStatusHistoryFile(filePath, merged);
  return merged;
}
