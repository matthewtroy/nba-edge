#!/usr/bin/env npx tsx
/** CI step: restore origin/data JSON into public/data without staging files on main. */
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import {
  dataBranchPresentOnRemote,
  restorePersistedDataFromBranch,
} from "../lib/restore-data-branch.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

try {
  execFileSync(
    "git",
    ["fetch", "origin", "+refs/heads/data:refs/heads/data"],
    { cwd: root, stdio: "inherit" }
  );
} catch {
  console.warn("ci-restore: fetch origin data failed (branch may not exist yet)");
}

const { restored, oddsMapKeys } = restorePersistedDataFromBranch(root, {
  requireWhenDataBranch: false,
});

if (dataBranchPresentOnRemote(root) && restored.length === 0) {
  console.error(
    "::error::Fetch data branch: remote data exists but restore wrote 0 files — check git ref resolution"
  );
  process.exit(1);
}

if (restored.length) {
  console.log(
    `ci-restore OK: ${restored.length} file(s), oddsMap keys ${oddsMapKeys}`
  );
} else {
  console.log("ci-restore: no data branch (first run) — skipped restore");
}