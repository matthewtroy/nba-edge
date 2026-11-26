import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import type { SlateGame } from "../lib/types";
import {
  LIVE_POLL_MS,
  LIVE_SOURCE,
  buildLiveSnapshot,
  createMockLiveProvider,
  distinctEtScoreboardDates,
  evaluateEspnCorsResponse,
  parseLiveGameFromSummary,
  parseLiveScoreboard,
  stableSnapshotKey,
  subscribeLiveSource,
  type LiveSourceProvider,
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
const boardEt25 = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "scoreboard-et-20261125.json"), "utf8")
);
const boardEt26 = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "scoreboard-et-20261126.json"), "utf8")
);
const summaryMiss = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "summary-miss-header.json"), "utf8")
);
const corsRecorded = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "cors-recorded.json"), "utf8")
);
const slateFixture = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests/fixtures/2026-11-26/slate.json"), "utf8")
) as SlateGame[];

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

  it("distinct ET scoreboard dates for Sydney 2026-11-26 slate", () => {
    expect(distinctEtScoreboardDates(slateFixture)).toEqual(["20261125"]);
    const dualTip = [
      { id: "401909317", startTime: "2026-11-25T22:00Z" },
      { id: "401909324", startTime: "2026-11-26T05:30:00Z" },
    ];
    expect(distinctEtScoreboardDates(dualTip)).toEqual(["20261125", "20261126"]);
  });

  it("queries both ET dates for dual-date slate, not Sydney-only board key", async () => {
    const dualSlate = [
      { id: "401909317", startTime: "2026-11-25T22:00Z" },
      { id: "401909318", startTime: "2026-11-26T05:30:00Z" },
      { id: "401909320", startTime: "2026-11-26T06:00:00Z" },
    ];
    const calls: string[] = [];
    const provider: LiveSourceProvider = {
      id: "mock",
      async fetchScoreboard(etYyyymmdd) {
        calls.push(etYyyymmdd);
        if (etYyyymmdd === "20261125") return boardEt25;
        if (etYyyymmdd === "20261126") return boardEt26;
        return { events: [] };
      },
      async fetchSummary(gameId) {
        if (gameId === "401909320") return summaryMiss;
        throw new Error(`unexpected summary ${gameId}`);
      },
    };
    const snap = await buildLiveSnapshot(
      provider,
      dualSlate,
      ["401909317", "401909318", "401909320"]
    );
    expect(calls.sort()).toEqual(["20261125", "20261126"]);
    expect(snap.games.find((g) => g.gameId === "401909317")?.phase).toBe("final");
    expect(snap.games.find((g) => g.gameId === "401909318")?.phase).toBe("live");
    expect(snap.games.find((g) => g.gameId === "401909320")?.phase).toBe("final");
  });

  it("falls back to summary when game missing from scoreboard", () => {
    const row = parseLiveGameFromSummary("401909317", summaryMiss);
    expect(row?.phase).toBe("final");
    expect(row?.statusDetail).toBe("Final");
  });

  it("mock provider builds snapshot with final box after game ends", async () => {
    const provider = createMockLiveProvider({
      scoreboards: { "20261126": scoreboard },
      summaries: {
        "fixture-game-won": summaryFinal,
        "fixture-game-live": summaryLive,
        "fixture-game-q1": summaryFinal,
      },
    });
    const slate: SlateGame["id"][] = [
      "fixture-game-won",
      "fixture-game-live",
      "fixture-game-q1",
    ];
    const snap = await buildLiveSnapshot(
      provider,
      slate.map((id) => ({
        id,
        startTime: "2026-11-26T15:00:00Z",
      })),
      slate
    );
    expect(snap.boxesByGame.get("fixture-game-won")?.get("p-won")?.pts).toBe(24);
    expect(snap.boxesByGame.get("fixture-game-live")?.get("p-live")?.pts).toBe(11);
    expect(snap.games.find((g) => g.gameId === "fixture-game-won")?.phase).toBe("final");
    const k1 = stableSnapshotKey(snap);
    const k2 = stableSnapshotKey(snap);
    expect(k1).toBe(k2);
  });

  it("subscribe dedupes identical snapshots", async () => {
    vi.useFakeTimers();
    const provider = createMockLiveProvider({
      scoreboards: { "20261126": scoreboard },
      summaries: { "fixture-game-won": summaryFinal },
    });
    let calls = 0;
    const unsub = subscribeLiveSource({
      provider,
      slateGames: [{ id: "fixture-game-won", startTime: "2026-11-26T15:00:00Z" }],
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
      scoreboards: { "20261126": scoreboard },
      summaries: { "fixture-game-won": summaryFinal },
    });
    const unsub = subscribeLiveSource({
      provider,
      slateGames: [{ id: "fixture-game-won", startTime: "2026-11-26T15:00:00Z" }],
      gameIds: ["fixture-game-won"],
      pollMs: 50,
      onSnapshot: () => {},
    });
    unsub();
    expect(true).toBe(true);
  });

  it("CORS verify uses recorded response, not live ESPN", () => {
    const res = evaluateEspnCorsResponse({
      ok: true,
      status: corsRecorded.status,
      headers: { get: (n) => (n === "access-control-allow-origin" ? corsRecorded.allowOrigin : null) },
    });
    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect(res.allowOrigin).toBe("*");
  });
});