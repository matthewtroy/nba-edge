import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import {
  DataBranchRestoreError,
  resolveDataGitRef,
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

  function seedDataBranch(repo: string, cacheBody: string) {
    const rootFiles = ["history.json", "odds-cache.json", "index.json", "game-log-cache.json"];
    for (const name of rootFiles) {
      fs.writeFileSync(
        path.join(repo, "public/data", name),
        name === "odds-cache.json" ? cacheBody : "{}"
      );
      git(repo, "add", `public/data/${name}`);
    }
    git(repo, "-c", "user.email=t@t.com", "-c", "user.name=T", "commit", "-m", "data");
    git(repo, "branch", "-M", "data");
  }

  it("resolves refs/remotes/origin/data when local data branch ref missing", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nba-restore-"));
    const bare = path.join(tmp, "bare.git");
    const origin = path.join(tmp, "origin");
    const consumer = path.join(tmp, "consumer");
    try {
      git(tmp, "init", "--bare", bare);
      git(tmp, "init", origin);
      git(origin, "remote", "add", "origin", bare);
      fs.mkdirSync(path.join(origin, "public/data"), { recursive: true });
      const cacheBody = JSON.stringify({ oddsMap: { k: { price: 2 } } });
      seedDataBranch(origin, cacheBody);
      git(origin, "push", "-u", "origin", "data");

      git(tmp, "clone", bare, consumer);
      git(consumer, "checkout", "-b", "main");
      git(consumer, "fetch", "origin", "data");
      expect(git_show_ref(consumer, "refs/heads/data")).toBe(false);
      expect(resolveDataGitRef(consumer)).toBe("refs/remotes/origin/data");

      const { restored, oddsMapKeys } = restorePersistedDataFromBranch(consumer, {
        requireWhenDataBranch: false,
      });
      expect(restored.length).toBeGreaterThan(0);
      expect(oddsMapKeys).toBe(1);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("resolves FETCH_HEAD after bare data fetch with no local branch", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nba-restore-"));
    const bare = path.join(tmp, "bare.git");
    const origin = path.join(tmp, "origin");
    const consumer = path.join(tmp, "consumer");
    try {
      git(tmp, "init", "--bare", bare);
      git(tmp, "init", origin);
      git(origin, "remote", "add", "origin", bare);
      fs.mkdirSync(path.join(origin, "public/data"), { recursive: true });
      seedDataBranch(origin, JSON.stringify({ oddsMap: { x: { price: 1.1 } } }));
      git(origin, "push", "-u", "origin", "data");

      git(tmp, "clone", "--depth", "1", bare, consumer);
      git(consumer, "checkout", "-b", "main");
      try {
        execFileSync("git", ["remote", "set-branches", "origin", "data"], {
          cwd: consumer,
        });
      } catch {
        /* older git */
      }
      execFileSync("git", ["fetch", "origin", "data"], { cwd: consumer, stdio: "pipe" });
      try {
        execFileSync("git", ["update-ref", "-d", "refs/remotes/origin/data"], {
          cwd: consumer,
          stdio: "ignore",
        });
      } catch {
        /* may not exist on shallow clone */
      }
      expect(resolveDataGitRef(consumer)).toBe("FETCH_HEAD");

      const { restored } = restorePersistedDataFromBranch(consumer, {
        requireWhenDataBranch: false,
      });
      expect(restored).toContain("public/data/odds-cache.json");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  function git_show_ref(cwd: string, ref: string): boolean {
    try {
      execFileSync("git", ["show-ref", "--verify", ref], { cwd, stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

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