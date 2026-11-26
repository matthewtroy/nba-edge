import { describe, expect, it } from "vitest";
import type { SlateGame } from "../lib/types";
import { gameForLiveLeg, mergeGamePhase } from "../lib/live-tracking";

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

describe("live-tracking phase linkage", () => {
  it("merges persisted final ahead of stale ESPN live", () => {
    expect(mergeGamePhase("final", "live")).toBe("final");
    expect(mergeGamePhase("live", "final")).toBe("final");
  });

  it("upgrades STATUS_SCHEDULED slate when ESPN is final", () => {
    const g = gameForLiveLeg(game("401909318", "STATUS_SCHEDULED"), "final");
    expect(g?.status).toBe("final");
  });

  it("keeps pipeline final when scoreboard omits a game", () => {
    const g = gameForLiveLeg(game("401909317", "final"), undefined);
    expect(g?.status).toBe("final");
  });
});