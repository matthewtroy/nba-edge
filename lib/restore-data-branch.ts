import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { retentionMinYmd, SLATE_FOLDER_PATTERN } from "./slate-retention.js";

/** Files at `public/data/` root persisted on the data branch. */
export const DATA_BRANCH_ROOT_FILES = [
  "history.json",
  "results.json",
  "odds-cache.json",
  "index.json",
  "game-log-cache.json",
] as const;

/** Required before pipeline reads (results.json is optional on older data commits). */
export const DATA_BRANCH_REQUIRED_ROOT_FILES = [
  "history.json",
  "odds-cache.json",
  "index.json",
  "game-log-cache.json",
] as const;

/** Per-slate artifacts restored for each retained folder on the data branch. */
export const DATA_BRANCH_SLATE_DIR_FILES = [
  "slate.json",
  "meta.json",
  "picks.json",
  "multis.json",
  "injuries.json",
  "odds-coverage.json",
  "official-card.json",
] as const;

/** Restored for every dated folder on the data branch (cumulative results / settle). */
export const DATA_BRANCH_CUMULATIVE_SLATE_FILES = [
  "results.json",
  "official-card.json",
  "meta.json",
] as const;

/** @deprecated use DATA_BRANCH_SLATE_DIR_FILES */
export const DATA_BRANCH_SLATE_FILES = ["official-card.json"] as const;

const DATA_REF_CANDIDATES = [
  "refs/heads/data",
  "refs/remotes/origin/data",
  "FETCH_HEAD",
] as const;

function refExists(rootDir: string, ref: string): boolean {
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

/** Pick the git ref that holds origin/data after CI fetch (first match wins). */
export function resolveDataGitRef(rootDir: string): string | null {
  for (const ref of DATA_REF_CANDIDATES) {
    if (refExists(rootDir, ref)) return ref;
  }
  return null;
}

function gitShow(rootDir: string, dataRef: string, relPath: string): Buffer | null {
  try {
    return execFileSync("git", ["show", `${dataRef}:${relPath}`], {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

function restoreOne(
  rootDir: string,
  dataRef: string,
  relPath: string,
  outPath: string
): boolean {
  const blob = gitShow(rootDir, dataRef, relPath);
  if (blob == null) return false;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, blob);
  return true;
}

export class DataBranchRestoreError extends Error {}

/** Every `YYYY-MM-DD` folder on the data branch under `public/data` (not index.json). */
export function listAllSlateFoldersOnDataRef(rootDir: string, dataRef: string): string[] {
  try {
    const raw = execFileSync(
      "git",
      ["ls-tree", "-d", "--name-only", `${dataRef}:public/data`],
      { cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((name) => SLATE_FOLDER_PATTERN.test(name))
      .sort();
  } catch {
    return [];
  }
}

/** Slate folder dates on the data branch within the Sydney retention window (not index.json). */
export function listSlateFoldersOnDataRef(
  rootDir: string,
  dataRef: string,
  now: Date
): string[] {
  const min = retentionMinYmd(now);
  return listAllSlateFoldersOnDataRef(rootDir, dataRef).filter((name) => name >= min);
}

function dataBranchExists(rootDir: string): boolean {
  return resolveDataGitRef(rootDir) != null;
}

/** Restore must-persist JSON from origin/data into public/data (no-op if data branch missing). */
export function restorePersistedDataFromBranch(
  rootDir: string,
  opts: { requireWhenDataBranch?: boolean } = {}
): {
  restored: string[];
  oddsMapKeys: number;
  dataRef: string | null;
} {
  const require = opts.requireWhenDataBranch ?? true;
  const dataRef = resolveDataGitRef(rootDir);
  const hasData = dataRef != null;

  if (dataRef) {
    console.log(`restore: using git ref ${dataRef}`);
  }

  if (require && !hasData) {
    throw new DataBranchRestoreError("data branch missing — cannot restore persisted JSON");
  }

  if (!hasData) {
    return { restored: [], oddsMapKeys: 0, dataRef: null };
  }

  const dataRoot = path.join(rootDir, "public/data");
  const restored: string[] = [];

  for (const name of DATA_BRANCH_ROOT_FILES) {
    const rel = `public/data/${name}`;
    if (restoreOne(rootDir, dataRef, rel, path.join(dataRoot, name))) {
      restored.push(rel);
    }
  }

  if (require && hasData) {
    const missingRoot = DATA_BRANCH_REQUIRED_ROOT_FILES.filter((name) => {
      const rel = `public/data/${name}`;
      return !restored.includes(rel) && !fs.existsSync(path.join(dataRoot, name));
    });
    if (missingRoot.length) {
      throw new DataBranchRestoreError(
        `data branch restore incomplete: missing ${missingRoot.join(", ")}`
      );
    }
  }

  const restoreNow = new Date();
  const allSlateFolders = listAllSlateFoldersOnDataRef(rootDir, dataRef);
  const retainedFolders = listSlateFoldersOnDataRef(rootDir, dataRef, restoreNow);
  if (allSlateFolders.length) {
    console.log(
      `restore: all slate folders on data branch (${allSlateFolders.join(", ")})`
    );
  }
  if (retainedFolders.length) {
    console.log(`restore: retained for display (${retainedFolders.join(", ")})`);
  }
  try {
    const headshotList = execFileSync(
      "git",
      ["ls-tree", "-r", "--name-only", dataRef, "public/data/headshots"],
      { cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    for (const rel of headshotList.split("\n").map((l) => l.trim()).filter(Boolean)) {
      const out = path.join(rootDir, rel);
      if (restoreOne(rootDir, dataRef, rel, out)) restored.push(rel);
    }
  } catch {
    /* optional headshots folder */
  }

  for (const ymd of allSlateFolders) {
    for (const name of DATA_BRANCH_CUMULATIVE_SLATE_FILES) {
      const rel = `public/data/${ymd}/${name}`;
      const out = path.join(dataRoot, ymd, name);
      if (restoreOne(rootDir, dataRef, rel, out)) restored.push(rel);
    }
  }

  for (const ymd of retainedFolders) {
    for (const name of DATA_BRANCH_SLATE_DIR_FILES) {
      const rel = `public/data/${ymd}/${name}`;
      const out = path.join(dataRoot, ymd, name);
      if (restoreOne(rootDir, dataRef, rel, out)) restored.push(rel);
    }
  }

  if (!restored.some((r) => r.includes("/slate.json"))) {
    try {
      const raw = execFileSync(
        "git",
        ["ls-tree", "-r", "--name-only", dataRef, "public/data"],
        { cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
      );
      const slateOfficial = raw
        .split("\n")
        .filter((p) => /\/official-card\.json$/.test(p));
      for (const rel of slateOfficial) {
        const out = path.join(rootDir, rel);
        if (restoreOne(rootDir, dataRef, rel, out)) restored.push(rel);
      }
    } catch {
      /* ls-tree failed */
    }
  }

  let oddsMapKeys = 0;
  const oddsCachePath = path.join(dataRoot, "odds-cache.json");
  if (fs.existsSync(oddsCachePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(oddsCachePath, "utf8")) as {
        oddsMap?: Record<string, unknown>;
      };
      oddsMapKeys = Object.keys(parsed.oddsMap ?? {}).length;
    } catch {
      oddsMapKeys = 0;
    }
  }
  console.log(`restore: odds-cache oddsMap ${oddsMapKeys}`);
  if (restored.length) {
    console.log(
      `data branch restore: ${restored.length} file(s) → public/data (${restored
        .map((r) => path.basename(r))
        .join(", ")})`
    );
  }
  return { restored, oddsMapKeys, dataRef };
}

/** True when origin/data (or local data) is reachable after fetch. */
export function dataBranchPresentOnRemote(rootDir: string): boolean {
  return (
    refExists(rootDir, "refs/heads/data") || refExists(rootDir, "refs/remotes/origin/data")
  );
}