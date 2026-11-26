import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import {
  LIVE_POLL_MS,
  LIVE_SOURCE,
  buildLiveSnapshot,
  createMockLiveProvider,
  parseLiveScoreboard,
  stableSnapshotKey,
  subscribeLiveSource,
  verifyEspnCorsForPages,
} from "../lib/live-source";

const fixtureDir = path.join(process.cwd(), "tests/fixtures/espn");
const scoreboard = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "scoreboard-mini.json"), "utf8")
);
const summaryFinal = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "summary-final.json"), "utf8")
);
const summaryLive = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "summary-live.json"), "utf8")
);

describe("live-source", () => {
  it("exports poll constants", () => {
    expect(LIVE_POLL_MS).toBe(5000);
    expect(LIVE_SOURCE).toBe("espn-direct");
  });

  it("parses scoreboard phases", () => {
    const games = parseLiveScoreboard(scoreboard);
    expect(games.map((g) => g.gameId)).toEqual([
      "fixture-game-won",
      "fixture-game-live",
      "fixture-game-q1",
      "fixture-game-scheduled",
    ]);
    expect(games[0].phase).toBe("final");
    expect(games[1].phase).toBe("live");
    expect(games[3].phase).toBe("scheduled");
  });

  it("mock provider builds snapshot with dedupe key stability", async () => {
    const provider = createMockLiveProvider({
      scoreboard,
      summaries: {
        "fixture-game-won": summaryFinal,
        "fixture-game-live": summaryLive,
        "fixture-game-q1": summaryFinal,
      },
    });
    const snap = await buildLiveSnapshot(
      provider,
      new Date("2026-11-26T12:00:00Z"),
      ["fixture-game-won", "fixture-game-live", "fixture-game-q1"]
    );
    expect(snap.boxesByGame.get("fixture-game-won")?.get("p-won")?.pts).toBe(24);
    expect(snap.boxesByGame.get("fixture-game-live")?.get("p-live")?.pts).toBe(11);
    const k1 = stableSnapshotKey(snap);
    const k2 = stableSnapshotKey(snap);
    expect(k1).toBe(k2);
  });

  it("subscribe dedupes identical snapshots", async () => {
    vi.useFakeTimers();
    const provider = createMockLiveProvider({
      scoreboard,
      summaries: { "fixture-game-won": summaryFinal },
    });
    let calls = 0;
    const unsub = subscribeLiveSource({
      provider,
      date: new Date("2026-11-26"),
      gameIds: ["fixture-game-won"],
      pollMs: 1000,
      onSnapshot: () => {
        calls += 1;
      },
    });
    await vi.advanceTimersByTimeAsync(50);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1100);
    expect(calls).toBe(1);
    unsub();
    vi.useRealTimers();
  });

  it("subscribe aborts on unsubscribe", async () => {
    const provider = createMockLiveProvider({
      scoreboard,
      summaries: { "fixture-game-won": summaryFinal },
    });
    const unsub = subscribeLiveSource({
      provider,
      date: new Date("2026-11-26"),
      gameIds: ["fixture-game-won"],
      pollMs: 50,
      onSnapshot: () => {},
    });
    unsub();
    expect(true).toBe(true);
  });

  it("CORS verify for GitHub Pages", async () => {
    const res = await verifyEspnCorsForPages();
    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect(res.allowOrigin).toBe("*");
  });
});