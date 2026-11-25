import { describe, expect, it } from "vitest";
import {
  allGamesStartedForSlate,
  computeSlateStatus,
} from "../lib/slate-publication";
import type { MetaJson, SlateGame } from "../lib/types";
import type { OfficialCardFile } from "../lib/official-card-time";

const slate: SlateGame[] = [
  {
    id: "g1",
    startTime: "2026-11-25T10:00:00Z",
    startTimeSydney: "9:00 pm",
    homeTeam: "Boston Celtics",
    awayTeam: "Brooklyn Nets",
    homeTeamId: "h1",
    awayTeamId: "a1",
    homeB2B: false,
    awayB2B: false,
    status: "pre",
  },
];

const meta: MetaJson = {
  lastUpdated: "2026-11-25T08:00:00Z",
  sources: {},
  slateSize: 1,
  slateTipDate: "2026-11-25",
};

describe("slate publication", () => {
  it("draft before official evening", () => {
    const now = new Date("2026-11-25T08:00:00Z");
    const status = computeSlateStatus(slate, meta, null, now);
    expect(status.status).toBe("draft");
    expect(status.statusLabel).toContain("Draft");
  });

  it("official when card matches slate date", () => {
    const card: OfficialCardFile = {
      lockedAt: "2026-11-25T10:12:00Z",
      publishedAt: "2026-11-25T10:12:00Z",
      slateDate: "2026-11-25",
      bookie: "Sportsbet",
      multis: [],
      notBuilt: [],
      whatChanged: [],
      injuries: [],
    };
    const now = new Date("2026-11-25T09:30:00Z");
    const status = computeSlateStatus(slate, meta, card, now);
    expect(status.status).toBe("official");
    expect(status.statusLabel).toMatch(/Official · published/);
  });

  it("locked once every game has started", () => {
    const live = { ...slate[0], status: "In Progress" };
    const now = new Date("2026-11-25T10:30:00Z");
    expect(allGamesStartedForSlate([live], now)).toBe(true);
    const status = computeSlateStatus([live], meta, null, now);
    expect(status.status).toBe("locked_at_tip");
  });
});