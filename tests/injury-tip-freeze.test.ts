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

const nykCle: SlateGame = {
  id: "401909319",
  startTime: "2026-11-26T00:30:00Z",
  startTimeSydney: "11:30 am",
  homeTeam: "Cleveland Cavaliers",
  awayTeam: "New York Knicks",
  homeTeamId: "5",
  awayTeamId: "18",
  homeB2B: false,
  awayB2B: false,
  status: "live",
};

describe("freezeInjuriesAtTip", () => {
  it("keeps pre-tip status after game has started", () => {
    const prev = [kat("Probable")];
    const incoming = [kat("Questionable")];
    const now = new Date("2026-11-26T10:05:00Z");
    const rows = freezeInjuriesAtTip(prev, incoming, [game], now);
    expect(rows[0].status).toBe("Probable");
  });

  it("KAT: locks Probable from 02:45pm reportTime, not stale 1:39pm row", () => {
    const earlier: InjuryEntry = {
      ...kat("Questionable"),
      gameId: "401909319",
      reportTime: "2026-11-25T13:39:22.578Z",
      updatedAt: "2026-11-26T12:00:00Z",
    };
    const later: InjuryEntry = {
      ...kat("Probable"),
      gameId: "401909319",
      reportTime: "2026-11-25T19:45:15.024Z",
      updatedAt: "2026-11-25T19:45:15.024Z",
    };
    const postTip: InjuryEntry = {
      ...kat("Out"),
      gameId: "401909319",
      reportTime: "2026-11-26T01:00:00Z",
      updatedAt: "2026-11-26T01:00:00Z",
    };
    const prev = [earlier, later];
    const incoming = [postTip];
    const now = new Date("2026-11-26T00:35:00Z");
    const rows = freezeInjuriesAtTip(prev, incoming, [nykCle], now);
    expect(rows.find((r) => r.playerId === "3136195")?.status).toBe("Probable");
  });
});