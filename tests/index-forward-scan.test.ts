import { describe, expect, it } from "vitest";
import type { SlateGame } from "../lib/types";
import { forwardSlateMetadataFromGames } from "../lib/index-forward-scan";

function game(iso: string, id = "1"): SlateGame {
  return {
    id,
    awayTeam: "Away",
    homeTeam: "Home",
    awayTeamId: "1",
    homeTeamId: "2",
    startTime: iso,
    status: "Scheduled",
  };
}

describe("forwardSlateMetadataFromGames", () => {
  it("2026-11-26T05:30Z Thanksgiving → next slate 28 Nov, publish eve 27 Nov 21:00 Sydney", () => {
    const now = new Date("2026-11-26T05:30:00.000Z");
    const meta = forwardSlateMetadataFromGames(
      [game("2026-11-27T23:00:00.000Z", "g1")],
      now
    );
    expect(meta?.nextSlateDate).toBe("2026-11-28");
    expect(meta?.nextPublishAt).toBe("2026-11-27T10:00:00.000Z");
    expect(meta?.games?.length).toBe(1);
    expect(meta?.firstTipAt).toBe("2026-11-27T23:00:00.000Z");
  });

  it("2026-11-26T05:46Z Sydney today slate + Thanksgiving → next slate strictly after today", () => {
    const now = new Date("2026-11-26T05:46:00.000Z");
    const merged = [
      game("2026-11-26T09:00:00.000Z", "today-1"),
      game("2026-11-27T23:00:00.000Z", "fut-1"),
    ];
    const meta = forwardSlateMetadataFromGames(merged, now);
    expect(meta?.nextSlateDate).toBe("2026-11-28");
    expect(meta?.nextPublishAt).toBe("2026-11-27T10:00:00.000Z");
  });

  it("2026-11-26T07:00Z prefers tomorrow Sydney slate when on board", () => {
    const now = new Date("2026-11-26T07:00:00.000Z");
    const merged = [
      game("2026-11-26T09:00:00.000Z", "today-1"),
      game("2026-11-27T09:00:00.000Z", "tmr-1"),
    ];
    const meta = forwardSlateMetadataFromGames(merged, now);
    expect(meta?.nextSlateDate).toBe("2026-11-27");
    expect(meta?.nextPublishAt).toBe("2026-11-26T10:00:00.000Z");
  });

  it("never returns Sydney today as nextSlateDate when today has games", () => {
    const now = new Date("2026-11-26T05:46:00.000Z");
    const merged = [game("2026-11-26T11:00:00.000Z", "only-today")];
    const meta = forwardSlateMetadataFromGames(merged, now);
    expect(meta).toBeNull();
  });
});