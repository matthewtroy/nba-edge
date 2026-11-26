import { describe, expect, it } from "vitest";
import type { InjuryEntry, SlateGame } from "../lib/types";
import {
  injuriesForInjuryPanel,
  refreshInjuriesAtTip,
} from "../lib/injuries-at-tip";
import { injuriesForBadges } from "../lib/injury-display";

const slate: SlateGame[] = [
  {
    id: "g-started",
    startTime: "2026-11-26T10:00:00.000Z",
    startTimeSydney: "9pm",
    homeTeam: "H",
    awayTeam: "A",
    homeTeamId: "h",
    awayTeamId: "a",
    homeB2B: false,
    awayB2B: false,
    status: "live",
  },
  {
    id: "g-next",
    startTime: "2026-11-26T13:00:00.000Z",
    startTimeSydney: "midnight",
    homeTeam: "H2",
    awayTeam: "A2",
    homeTeamId: "h2",
    awayTeamId: "a2",
    homeB2B: false,
    awayB2B: false,
    status: "Scheduled",
  },
];

const inj = (
  playerId: string,
  gameId: string,
  status: InjuryEntry["status"],
  updatedAt: string
): InjuryEntry => ({
  playerId,
  playerName: playerId,
  teamId: "t",
  teamName: "T",
  gameId,
  status,
  source: "ESPN",
  updatedAt,
  reportTime: updatedAt,
});

describe("injuriesAtTip", () => {
  it("persists pre-tip snapshot when game has started", () => {
    const history = [
      inj("p1", "g-started", "Probable", "2026-11-26T09:50:00.000Z"),
      inj("p1", "g-started", "Questionable", "2026-11-26T10:30:00.000Z"),
    ];
    const now = new Date("2026-11-26T10:05:00.000Z");
    const atTip = refreshInjuriesAtTip(undefined, history, slate, now);
    expect(atTip.find((r) => r.playerId === "p1")?.status).toBe("Probable");
  });

  it("panel shows at-tip rows for started games and live for next game only", () => {
    const atTip = [inj("p1", "g-started", "Probable", "2026-11-26T09:50:00.000Z")];
    const live = [
      inj("p1", "g-started", "Out", "2026-11-26T10:30:00.000Z"),
      inj("p2", "g-next", "Questionable", "2026-11-26T10:20:00.000Z"),
    ];
    const now = new Date("2026-11-26T10:20:00.000Z");
    const panel = injuriesForInjuryPanel(live, atTip, slate, now);
    expect(panel.find((r) => r.playerId === "p1")?.status).toBe("Probable");
    expect(panel.find((r) => r.playerId === "p2")?.status).toBe("Questionable");
  });

  it("no badge without at-tip snapshot on started game", () => {
    const live = [inj("p1", "g-started", "Out", "2026-11-26T10:30:00.000Z")];
    const rows = injuriesForBadges(live, {
      slate: [slate[0]!],
      previous: [],
      now: new Date("2026-11-26T10:20:00.000Z"),
    });
    expect(rows.find((r) => r.playerId === "p1")?.status).toBe("Available");
  });
});