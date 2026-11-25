import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

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

/** Per-slate files restored before each pipeline run (never dropped on normal builds). */
export const DATA_BRANCH_SLATE_FILES = ["official-card.json"] as const;

const DATA_REF = "refs/heads/data";

function gitShow(rootDir: string, relPath: string): Buffer | null {
  try {
    return execFileSync("git", ["show", `${DATA_REF}:${relPath}`], {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

function restoreOne(rootDir: string, relPath: string, outPath: string): boolean {
  const blob = gitShow(rootDir, relPath);
  if (blob == null) return false;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, blob);
  return true;
}

export class DataBranchRestoreError extends Error {}

function dataBranchExists(rootDir: string): boolean {
  try {
    execFileSync("git", ["show-ref", "--verify", "--quiet", DATA_REF], {
      cwd: rootDir,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

/** Restore must-persist JSON from origin/data into public/data (no-op if data branch missing). */
export function restorePersistedDataFromBranch(
  rootDir: string,
  opts: { requireWhenDataBranch?: boolean } = {}
): {
  restored: string[];
  oddsMapKeys: number;
} {
  const require = opts.requireWhenDataBranch ?? true;
  const hasData = dataBranchExists(rootDir);
  if (require && !hasData) {
    throw new DataBranchRestoreError("data branch missing — cannot restore persisted JSON");
  }

  const dataRoot = path.join(rootDir, "public/data");
  const restored: string[] = [];

  for (const name of DATA_BRANCH_ROOT_FILES) {
    const rel = `public/data/${name}`;
    if (restoreOne(rootDir, rel, path.join(dataRoot, name))) {
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

  let tree: { path: string }[] | null = null;
  try {
    const raw = execFileSync(
      "git",
      ["ls-tree", "-r", "--name-only", DATA_REF, "public/data"],
      { cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    const slateOfficial = raw
      .split("\n")
      .filter((p) => /\/official-card\.json$/.test(p));
    for (const rel of slateOfficial) {
      const out = path.join(rootDir, rel);
      if (restoreOne(rootDir, rel, out)) restored.push(rel);
    }
  } catch {
    /* data branch absent */
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
  return { restored, oddsMapKeys };
}