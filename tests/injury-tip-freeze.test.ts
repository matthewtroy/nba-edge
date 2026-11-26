import { describe, expect, it } from "vitest";
import type { InjuryEntry, SlateGame } from "../lib/types";
import { freezeInjuriesAtTip } from "../lib/injury-tip-freeze";

const game: SlateGame = {
  id: "g1",
  startTime: "2026-11-26T10:00:00Z",
  startTimeSydney: "9pm",
  homeTeam: "H",
  awayTeam: "A",
  homeTeamId: "h",
  awayTeamId: "a",
  homeB2B: false,
  awayB2B: false,
  status: "live",
};

const kat = (status: InjuryEntry["status"]): InjuryEntry => ({
  playerId: "3136195",
  playerName: "Karl-Anthony Towns",
  teamId: "18",
  teamName: "Knicks",
  gameId: "g1",
  status,
  source: "NBA Official",
  updatedAt: "2026-11-26T10:30:00Z",
  reportTime: "2026-11-26T10:30:00Z",
});

describe("freezeInjuriesAtTip", () => {
  it("keeps pre-tip status after game has started", () => {
    const prev = [kat("Probable")];
    const incoming = [kat("Questionable")];
    const now = new Date("2026-11-26T10:05:00Z");
    const rows = freezeInjuriesAtTip(prev, incoming, [game], now);
    expect(rows[0].status).toBe("Probable");
  });
});