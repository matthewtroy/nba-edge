import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { logOfficialCard } from "../lib/official-card-log";
import { restorePersistedDataFromBranch } from "../lib/restore-data-branch";

function git(cwd: string, ...args: string[]) {
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" });
}

describe("official card persistence", () => {
  it("kept log line format", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logOfficialCard("kept", "published 2026-11-26T12:00:00.000Z");
    expect(spy.mock.calls[0][0]).toBe(
      "official card: kept (published 2026-11-26T12:00:00.000Z)"
    );
    spy.mockRestore();
  });

  it("restore keeps official-card byte-identical across runs", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nba-official-"));
    const repo = path.join(tmp, "repo");
    try {
      git(tmp, "init", repo);
      fs.mkdirSync(path.join(repo, "public/data/2026-11-26"), { recursive: true });
      for (const name of ["history.json", "odds-cache.json", "index.json", "game-log-cache.json"]) {
        fs.writeFileSync(
          path.join(repo, "public/data", name),
          name === "index.json"
            ? JSON.stringify({ defaultDate: "2026-11-26" })
            : "{}"
        );
      }
      const official = {
        lockedAt: "2026-11-26T12:00:00Z",
        publishedAt: "2026-11-26T12:00:00Z",
        slateDate: "2026-11-26",
        bookie: "Ladbrokes",
        multis: [],
        notBuilt: [],
        whatChanged: [],
        injuries: [],
      };
      const rel = "public/data/2026-11-26/official-card.json";
      const abs = path.join(repo, rel);
      const body = JSON.stringify(official, null, 2);
      fs.writeFileSync(abs, body);
      git(repo, "add", "public/data");
      git(repo, "-c", "user.email=t@t.com", "-c", "user.name=T", "commit", "-m", "data");
      git(repo, "branch", "-M", "data");
      fs.writeFileSync(abs, "{}");
      restorePersistedDataFromBranch(repo);
      expect(fs.readFileSync(abs, "utf8")).toBe(body);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});