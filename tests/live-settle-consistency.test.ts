import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { gradeOfficialLeg } from "../lib/settle-core";
import type { OfficialLegSnapshot } from "../lib/official-card-time";
import type { PickLeg, SlateGame } from "../lib/types";
import { liveLegView } from "../lib/live-leg";
import { buildLiveSnapshot, createMockLiveProvider } from "../lib/live-source";

const fixtureDir = path.join(process.cwd(), "tests/fixtures/espn");
const scoreboard = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "scoreboard-mini.json"), "utf8")
);
const summaryFinal = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "summary-final.json"), "utf8")
);

const boxesPath = path.join(process.cwd(), "fixtures/settle-boxes.json");
const raw = JSON.parse(fs.readFileSync(boxesPath, "utf8")) as Record<
  string,
  Record<string, { minutes: number; pts: number; reb: number; ast: number; threes: number; q1?: { pts: number; reb: number; ast: number } }>
>;

function snap(
  partial: Partial<OfficialLegSnapshot> & Pick<OfficialLegSnapshot, "id" | "playerId" | "gameId" | "market" | "line">
): OfficialLegSnapshot {
  return {
    playerName: "Test",
    team: "A",
    publishedBookie: "TAB",
    fairPrice: 1.5,
    takeAt: 1.62,
    probability: 0.65,
    reasons: [],
    ...partial,
  };
}

function pickFromSnap(s: OfficialLegSnapshot): PickLeg {
  return {
    id: s.id,
    gameId: s.gameId,
    team: s.team,
    opponent: "",
    playerId: s.playerId,
    playerName: s.playerName,
    headshotUrl: "",
    market: s.market as PickLeg["market"],
    line: s.line,
    probability: s.probability,
    fairPrice: s.fairPrice,
    takeAt: s.takeAt,
    tags: [],
    reasons: [],
  };
}

const finalGame: SlateGame = {
  id: "fixture-game-won",
  startTime: "2026-11-26T10:00:00Z",
  startTimeSydney: "9pm",
  homeTeam: "Home",
  awayTeam: "Away",
  homeTeamId: "h",
  awayTeamId: "a",
  homeB2B: false,
  awayB2B: false,
  status: "final",
};

describe("live settle consistency", () => {
  it("final fixture legs match settle-core", async () => {
    const provider = createMockLiveProvider({
      scoreboards: { "20261126": scoreboard },
      summaries: { "fixture-game-won": summaryFinal },
    });
    const liveSnap = await buildLiveSnapshot(
      provider,
      [{ id: finalGame.id, startTime: finalGame.startTime }],
      ["fixture-game-won"]
    );
    const cases = [
      snap({ id: "w", playerId: "p-won", gameId: "fixture-game-won", market: "pts", line: 20 }),
      snap({ id: "l", playerId: "p-lost", gameId: "fixture-game-won", market: "pts", line: 20 }),
      snap({ id: "v", playerId: "p-void", gameId: "fixture-game-won", market: "pts", line: 20 }),
      snap({ id: "q", playerId: "p-q1", gameId: "fixture-game-won", market: "q1pts", line: 7 }),
    ];
    for (const s of cases) {
      const box = { ...raw[s.gameId][s.playerId], playerId: s.playerId };
      const settled = gradeOfficialLeg(s, box).result;
      const liveBox =
        s.playerId === "p-void"
          ? box
          : liveSnap.boxesByGame.get(s.gameId)?.get(s.playerId);
      const live = liveLegView(pickFromSnap(s), finalGame, liveBox, {
        period: 4,
        statusDetail: "Final",
      });
      const mapped =
        live.state === "won"
          ? "won"
          : live.state === "lost"
            ? "lost"
            : live.state === "void"
              ? "void"
              : "pending";
      expect(mapped).toBe(settled);
    }
  });
});