import { describe, expect, it } from "vitest";
import type { PickLeg, SlateGame } from "../lib/types";
import { liveLegView, q1TrackingOpen } from "../lib/live-leg";
import type { BoxLine } from "../scripts/espn-parse";

const game = (id: string, status: string): SlateGame => ({
  id,
  startTime: "2026-11-26T10:00:00Z",
  startTimeSydney: "9pm",
  homeTeam: "Home",
  awayTeam: "Away",
  homeTeamId: "h",
  awayTeamId: "a",
  homeB2B: false,
  awayB2B: false,
  status,
});

const leg = (overrides: Partial<PickLeg> & Pick<PickLeg, "id" | "gameId" | "playerId" | "market" | "line">): PickLeg => ({
  team: "A",
  opponent: "B",
  playerName: "Test",
  headshotUrl: "",
  probability: 0.6,
  fairPrice: 1.5,
  takeAt: 1.6,
  tags: [],
  reasons: [],
  ...overrides,
});

const box = (partial: Partial<BoxLine> & Pick<BoxLine, "playerId">): BoxLine => ({
  minutes: 30,
  pts: 10,
  reb: 5,
  ast: 3,
  threes: 1,
  ...partial,
});

describe("live-leg", () => {
  it("pending before tip", () => {
    const v = liveLegView(
      leg({ id: "l1", gameId: "g1", playerId: "p1", market: "pts", line: 20 }),
      game("g1", "scheduled"),
      undefined
    );
    expect(v.state).toBe("pending");
  });

  it("live in progress below line", () => {
    const v = liveLegView(
      leg({ id: "l2", gameId: "g2", playerId: "p-live", market: "pts", line: 20 }),
      game("g2", "live"),
      box({ playerId: "p-live", pts: 14 })
    );
    expect(v.state).toBe("live");
    expect(v.actual).toBe(14);
  });

  it("won immediate when line cleared", () => {
    const v = liveLegView(
      leg({ id: "l3", gameId: "g2", playerId: "p-live", market: "pts", line: 20 }),
      game("g2", "live"),
      box({ playerId: "p-live", pts: 22 })
    );
    expect(v.state).toBe("won");
  });

  it("lost after final", () => {
    const v = liveLegView(
      leg({ id: "l4", gameId: "g3", playerId: "p-lost", market: "pts", line: 20 }),
      game("g3", "final"),
      box({ playerId: "p-lost", pts: 14 })
    );
    expect(v.state).toBe("lost");
  });

  it("void on dnp", () => {
    const v = liveLegView(
      leg({ id: "l5", gameId: "g3", playerId: "p-void", market: "pts", line: 20 }),
      game("g3", "final"),
      box({ playerId: "p-void", minutes: 0, pts: 0 })
    );
    expect(v.state).toBe("void");
  });

  it("q1 live and closed", () => {
    expect(q1TrackingOpen(game("g-q", "live"), 1, "Q1 2:00")).toBe(true);
    expect(q1TrackingOpen(game("g-q", "live"), 2, "Q2 8:00")).toBe(false);
    const open = liveLegView(
      leg({ id: "q1", gameId: "g-q", playerId: "p-q1", market: "q1pts", line: 7 }),
      game("g-q", "live"),
      box({ playerId: "p-q1", pts: 5, q1: { pts: 5, reb: 1, ast: 0 } }),
      { period: 1, statusDetail: "Q1 2:00" }
    );
    expect(open.state).toBe("live");
    const closed = liveLegView(
      leg({ id: "q1b", gameId: "g-q", playerId: "p-q1", market: "q1pts", line: 7 }),
      game("g-q", "live"),
      box({ playerId: "p-q1", pts: 5, q1: { pts: 5, reb: 1, ast: 0 } }),
      { period: 2, statusDetail: "Q2 9:00" }
    );
    expect(closed.state).toBe("lost");
  });
});