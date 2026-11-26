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
});