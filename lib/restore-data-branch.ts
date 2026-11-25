import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

/** Files at `public/data/` root persisted on the data branch. */
export const DATA_BRANCH_ROOT_FILES = [
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

/** Restore must-persist JSON from origin/data into public/data (no-op if data branch missing). */
export function restorePersistedDataFromBranch(rootDir: string): {
  restored: string[];
} {
  const dataRoot = path.join(rootDir, "public/data");
  const restored: string[] = [];

  for (const name of DATA_BRANCH_ROOT_FILES) {
    const rel = `public/data/${name}`;
    if (restoreOne(rootDir, rel, path.join(dataRoot, name))) {
      restored.push(rel);
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

  if (restored.length) {
    console.log(
      `data branch restore: ${restored.length} file(s) → public/data (${restored
        .map((r) => path.basename(r))
        .join(", ")})`
    );
  }
  return { restored };
}