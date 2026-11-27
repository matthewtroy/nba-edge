import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import type { InjuryEntry } from "../lib/types";
import {
  emptyInjuryStatusHistory,
  injuryStatusHistoryEntryCount,
  loadInjuryStatusHistoryFile,
  recordInjuryStatusChanges,
  writeInjuryStatusHistoryFile,
  backfillInjuryStatusHistoryFromDataBranch,
  mergeInjuryStatusHistory,
} from "../lib/injury-status-history";
import {
  recentActiveStatusTransition,
  INJURY_STATUS_TRANSITION_WINDOW_MS,
} from "../lib/injury-status-history-ui";
import { persistJsonShrinkReason } from "../lib/espn-cache-guard";

function inj(
  playerId: string,
  name: string,
  status: InjuryEntry["status"],
  updatedAt: string
): InjuryEntry {
  return {
    playerId,
    playerName: name,
    teamId: "1",
    teamName: "Team",
    gameId: "g1",
    status,
    source: "NBA",
    updatedAt,
  };
}

describe("injury status history", () => {
  it("records Available → Questionable on injuries write compare", () => {
    const prev = [inj("p1", "Edey", "Available", "2026-11-28T00:00:00.000Z")];
    const next = [inj("p1", "Edey", "Questionable", "2026-11-28T06:00:00.000Z")];
    const updated = recordInjuryStatusChanges(emptyInjuryStatusHistory(), {
      slateDate: "2026-11-28",
      previous: prev,
      next,
      observedAt: "2026-11-28T06:00:00.000Z",
    });
    expect(updated.changes).toHaveLength(1);
    expect(updated.changes[0]?.fromStatus).toBe("Available");
    expect(updated.changes[0]?.toStatus).toBe("Questionable");
  });

  it("dedupes identical transitions within the same minute", () => {
    const prev: InjuryEntry[] = [];
    const next = [inj("p1", "Edey", "Questionable", "2026-11-28T06:00:00.000Z")];
    let h = recordInjuryStatusChanges(emptyInjuryStatusHistory(), {
      slateDate: "2026-11-28",
      previous: prev,
      next,
      observedAt: "2026-11-28T06:00:00.000Z",
    });
    h = recordInjuryStatusChanges(h, {
      slateDate: "2026-11-28",
      previous: prev,
      next,
      observedAt: "2026-11-28T06:00:05.000Z",
    });
    expect(h.changes).toHaveLength(1);
  });

  it("surfaces 48h Active transitions for UI", () => {
    const now = new Date("2026-11-28T12:00:00.000Z");
    const history = recordInjuryStatusChanges(emptyInjuryStatusHistory(), {
      slateDate: "2026-11-28",
      previous: [inj("edey", "Zach Edey", "Available", "2026-11-27T20:00:00.000Z")],
      next: [inj("edey", "Zach Edey", "Questionable", "2026-11-28T06:00:00.000Z")],
      observedAt: "2026-11-28T06:00:00.000Z",
    });
    const row = recentActiveStatusTransition(history, "edey", now, INJURY_STATUS_TRANSITION_WINDOW_MS);
    expect(row?.toStatus).toBe("Questionable");
    const stale = recentActiveStatusTransition(
      history,
      "edey",
      new Date(now.getTime() + INJURY_STATUS_TRANSITION_WINDOW_MS + 1)
    );
    expect(stale).toBeNull();
  });

  it("persist guard blocks >20% shrink on injury-status-history entry count", () => {
    const reason = persistJsonShrinkReason(
      "injury-status-history.json",
      100,
      50
    );
    expect(reason).toMatch(/injury-status-history/);
  });

  it("entry count helper matches changes length", () => {
    const h = recordInjuryStatusChanges(emptyInjuryStatusHistory(), {
      slateDate: "2026-11-28",
      previous: [],
      next: [inj("a", "A", "Out", "2026-11-28T01:00:00.000Z")],
      observedAt: "2026-11-28T01:00:00.000Z",
    });
    expect(injuryStatusHistoryEntryCount(h)).toBe(1);
  });

  it("backfills transitions from data-branch git history", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nba-inj-hist-"));
    const repo = path.join(tmp, "repo");
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: "pipe" });
    try {
      fs.mkdirSync(repo, { recursive: true });
      execFileSync("git", ["init"], { cwd: repo, stdio: "pipe" });
      const slateDir = path.join(repo, "public/data/2026-11-28");
      fs.mkdirSync(slateDir, { recursive: true });
      const v1 = [inj("edey", "Zach Edey", "Available", "2026-11-28T00:00:00.000Z")];
      const v2 = [inj("edey", "Zach Edey", "Questionable", "2026-11-28T06:00:00.000Z")];
      fs.writeFileSync(path.join(slateDir, "injuries.json"), JSON.stringify(v1));
      git("add", ".");
      git("-c", "user.email=t@t.com", "-c", "user.name=T", "commit", "-m", "inj v1");
      fs.writeFileSync(path.join(slateDir, "injuries.json"), JSON.stringify(v2));
      git("add", ".");
      git(
        "-c",
        "user.email=t@t.com",
        "-c",
        "user.name=T",
        "commit",
        "-m",
        "inj v2",
        "--date",
        "2026-11-28T06:00:00+00:00"
      );
      git("branch", "-M", "data");
      const now = new Date("2026-11-28T12:00:00.000Z");
      const backfill = backfillInjuryStatusHistoryFromDataBranch(repo, now, 3);
      expect(backfill.changes.some((c) => c.playerId === "edey" && c.toStatus === "Questionable")).toBe(
        true
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("merges on-disk and backfill without duplicates", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nba-inj-merge-"));
    const filePath = path.join(dir, "injury-status-history.json");
  try {
      const onDisk = recordInjuryStatusChanges(emptyInjuryStatusHistory(), {
        slateDate: "2026-11-28",
        previous: [],
        next: [inj("x", "X", "Out", "2026-11-28T01:00:00.000Z")],
        observedAt: "2026-11-28T01:00:00.000Z",
      });
      writeInjuryStatusHistoryFile(filePath, onDisk);
      const loaded = loadInjuryStatusHistoryFile(filePath);
      const merged = mergeInjuryStatusHistory(loaded, onDisk);
      expect(merged.changes).toHaveLength(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});