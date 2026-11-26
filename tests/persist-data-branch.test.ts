import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const scriptName = "persist-data-branch.sh";

function git(cwd: string, ...args: string[]) {
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" });
}

describe("persist-data-branch.sh", () => {
  it("exits 0 without checking out data on main (isolated remote)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nba-persist-"));
    const bare = path.join(tmp, "origin.git");
    const work = path.join(tmp, "work");
    try {
      git(tmp, "init", "--bare", bare);
      execFileSync("git", ["clone", `file://${bare}`, work], {
        cwd: tmp,
        encoding: "utf8",
        stdio: "pipe",
      });
      fs.mkdirSync(path.join(work, "scripts"), { recursive: true });
      fs.mkdirSync(path.join(work, "public/data"), { recursive: true });
      fs.writeFileSync(path.join(work, "public/data/history.json"), "{}");
      for (const rel of ["persist-data-branch.sh", "persist-guard-check.ts"]) {
        fs.copyFileSync(
          path.join(repoRoot, "scripts", rel),
          path.join(work, "scripts", rel)
        );
      }
      fs.cpSync(path.join(repoRoot, "lib"), path.join(work, "lib"), { recursive: true });
      fs.chmodSync(path.join(work, "scripts", scriptName), 0o755);
      fs.chmodSync(path.join(work, "scripts", "persist-guard-check.ts"), 0o644);
      git(work, "add", "scripts", "public/data/history.json");
      git(work, "-c", "user.email=t@t.com", "-c", "user.name=T", "commit", "-m", "init");
      const mainBranch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd: work,
        encoding: "utf8",
      }).trim();

      const out = execFileSync("bash", [path.join(work, "scripts", scriptName)], {
        cwd: work,
        encoding: "utf8",
      });
      expect(out).toMatch(
        /persist data branch: (pushed|no changes)|guard blocked persist/
      );
      const afterBranch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd: work,
        encoding: "utf8",
      }).trim();
      expect(afterBranch).toBe(mainBranch);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});