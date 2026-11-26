import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadH2hSeasonCache,
  putH2hSeasonCached,
  saveH2hSeasonCache,
  type H2hSeasonLogCacheFile,
} from "../lib/h2h-cache";
import {
  mergeH2hSeasonCaches,
  pruneH2hSeasonCacheBeyondModelWindow,
} from "../lib/h2h-season-cache-merge";
import { ensureH2hSeasonLogs } from "../lib/h2h-season-logs";
import * as espn from "../scripts/fetch/espn";

const tmpDirs: string[] = [];

function makeDataDir(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "h2h-race-"));
  tmpDirs.push(d);
  return d;
}

afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

function seedCache(dir: string, nPlayers: number): H2hSeasonLogCacheFile {
  const file: H2hSeasonLogCacheFile = {};
  const asOf = new Date("2026-11-27T12:00:00.000Z");
  const seasons = [2026, 2025, 2024];
  for (let i = 0; i < nPlayers; i++) {
    const playerId = `p${i}`;
    for (const season of seasons) {
      putH2hSeasonCached(file, {
        playerId,
        season,
        fetchedAt: "2026-11-20T00:00:00.000Z",
        logs: [
          {
            gameId: `g-${playerId}-${season}`,
            date: "2026-01-01",
            minutes: 20,
            pts: 0,
            reb: 0,
            ast: 0,
            threes: 0,
          },
        ],
      });
    }
  }
  saveH2hSeasonCache(dir, file);
  return file;
}

describe("h2h season cache concurrency", () => {
  it("20 concurrent ensureH2hSeasonLogs keep ≥ baseline entry count", async () => {
    const dir = makeDataDir();
    const baseline = seedCache(dir, 81);
    const baselineCount = Object.keys(baseline).length;
    expect(baselineCount).toBe(243);

    vi.spyOn(espn, "fetchPlayerGameLog").mockResolvedValue({ events: [] });

    const asOf = new Date("2026-11-27T12:00:00.000Z");
    const shared = structuredClone(loadH2hSeasonCache(dir));
    const playerIds = [...new Set(Object.values(baseline).map((r) => r.playerId))].slice(0, 20);

    await Promise.all(
      playerIds.map((playerId) =>
        ensureH2hSeasonLogs({
          rootDir: dir,
          playerId,
          asOf,
          fetchMissing: true,
          cache: shared,
        })
      )
    );

    const merged = mergeH2hSeasonCaches(baseline, pruneH2hSeasonCacheBeyondModelWindow(shared, asOf));
    expect(Object.keys(merged).length).toBeGreaterThanOrEqual(baselineCount);
  });

  it("corrupt partial file throws instead of shrinking on reload", () => {
    const dir = makeDataDir();
    const baseline = seedCache(dir, 10);
    const cachePath = path.join(dir, "h2h-season-cache.json");
    fs.writeFileSync(cachePath, "{not json", "utf8");
    expect(() => loadH2hSeasonCache(dir)).toThrow(/corrupt/);
    expect(Object.keys(loadH2hSeasonCache(dir, { baseline })).length).toBe(
      Object.keys(baseline).length
    );
  });

  it("merge keeps newer fetchedAt per key", () => {
    const older: H2hSeasonLogCacheFile = {
      "1:2026": {
        playerId: "1",
        season: 2026,
        fetchedAt: "2026-01-01T00:00:00.000Z",
        logs: [],
      },
    };
    const newer: H2hSeasonLogCacheFile = {
      "1:2026": {
        playerId: "1",
        season: 2026,
        fetchedAt: "2026-02-01T00:00:00.000Z",
        logs: [],
      },
    };
  const stale: H2hSeasonLogCacheFile = {
      "1:2026": {
        playerId: "1",
        season: 2026,
        fetchedAt: "2025-12-01T00:00:00.000Z",
        logs: [],
      },
    };
    const merged = mergeH2hSeasonCaches(older, newer);
    expect(merged["1:2026"].fetchedAt).toBe("2026-02-01T00:00:00.000Z");
    const kept = mergeH2hSeasonCaches(older, stale);
    expect(kept["1:2026"].fetchedAt).toBe("2026-01-01T00:00:00.000Z");
  });
});