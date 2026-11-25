import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import {
  DataBranchRestoreError,
  restorePersistedDataFromBranch,
} from "../lib/restore-data-branch";

function git(cwd: string, ...args: string[]) {
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" });
}

describe("restorePersistedDataFromBranch", () => {
  it("fails when data branch exists but odds-cache missing on branch", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nba-restore-"));
    const repo = path.join(tmp, "repo");
    try {
      git(tmp, "init", repo);
      fs.mkdirSync(path.join(repo, "public/data"), { recursive: true });
      fs.writeFileSync(path.join(repo, "public/data/index.json"), "{}");
      git(repo, "add", "public/data/index.json");
      git(repo, "-c", "user.email=t@t.com", "-c", "user.name=T", "commit", "-m", "data");
      git(repo, "branch", "-M", "data");
      expect(() =>
        restorePersistedDataFromBranch(repo, { requireWhenDataBranch: true })
      ).toThrow(DataBranchRestoreError);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("logs oddsMap key count after restore", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nba-restore-"));
    const repo = path.join(tmp, "repo");
    try {
      git(tmp, "init", repo);
      const cacheBody = JSON.stringify({ oddsMap: { "a|pts|10": { price: 1.5, bookie: "TAB" } } });
      fs.mkdirSync(path.join(repo, "public/data"), { recursive: true });
      for (const name of [
        "history.json",
        "odds-cache.json",
        "index.json",
        "game-log-cache.json",
      ]) {
        fs.writeFileSync(
          path.join(repo, "public/data", name),
          name === "odds-cache.json" ? cacheBody : "{}"
        );
        git(repo, "add", `public/data/${name}`);
      }
      git(repo, "-c", "user.email=t@t.com", "-c", "user.name=T", "commit", "-m", "data");
      git(repo, "branch", "-M", "data");
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { oddsMapKeys } = restorePersistedDataFromBranch(repo);
      expect(oddsMapKeys).toBe(1);
      expect(spy.mock.calls.some((c) => String(c[0]).includes("restore: odds-cache oddsMap 1"))).toBe(
        true
      );
      spy.mockRestore();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});