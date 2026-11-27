import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staging = process.argv[2];
if (!staging) {
  console.error("Usage: tsx scripts/persist-merge-headshots.ts <staging/public/data>");
  process.exit(2);
}

const destDir = path.join(staging, "headshots");
fs.mkdirSync(destDir, { recursive: true });

let merged = 0;
try {
  const raw = execFileSync(
    "git",
    ["ls-tree", "-r", "--name-only", "origin/data", "public/data/headshots"],
    { cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
  );
  for (const rel of raw.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const name = path.basename(rel);
    const out = path.join(destDir, name);
    if (fs.existsSync(out)) continue;
    try {
      const buf = execFileSync("git", ["show", `origin/data:${rel}`], {
        cwd: rootDir,
        stdio: ["ignore", "pipe", "ignore"],
      });
      fs.writeFileSync(out, buf);
      merged += 1;
    } catch {
      /* skip */
    }
  }
} catch {
  /* no prior headshots on data branch */
}

console.log(`persist headshots merge: ${merged} file(s) copied from origin/data`);