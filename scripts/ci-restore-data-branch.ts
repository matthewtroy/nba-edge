#!/usr/bin/env npx tsx
/** CI step: restore origin/data JSON into public/data without staging files on main. */
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { restorePersistedDataFromBranch } from "../lib/restore-data-branch.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

try {
  execFileSync("git", ["fetch", "origin", "data"], { cwd: root, stdio: "inherit" });
} catch {
  /* data branch may not exist on first run */
}

restorePersistedDataFromBranch(root, { requireWhenDataBranch: false });