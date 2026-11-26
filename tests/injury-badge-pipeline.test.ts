import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import type { InjuryEntry, SlateGame } from "../lib/types";
import { injuriesForBadges } from "../lib/injury-display";

function kat(status: InjuryEntry["status"]): InjuryEntry {
  return {
    playerId: "3136195",
    playerName: "Karl-Anthony Towns",
    teamId: "18",
    teamName: "New York Knicks",
    gameId: "401909319",
    status,
    source: "NBA Official",
    updatedAt: "2026-11-26T10:30:00Z",
    reportTime: "2026-11-26T10:30:00Z",
  };
}
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

describe("injury badge pipeline", () => {
  it("useData seeds freeze history from official-card injuries", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/hooks/useData.ts"),
      "utf8"
    );
    expect(src).toMatch(/injuriesAtTip/);
    expect(src).toMatch(/officialCard\?\.injuries/);
    expect(src).toMatch(/freezeInjuriesAtTip\([\s\S]*injuryHistory/);
  });

  it("badges call injuriesForBadges with slate", () => {
    const app = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf8");
    expect(app).toMatch(/injuriesForBadges\(data\.injuries,\s*\{[\s\S]*slate: data\.slate/);
  });

  it("KAT shows Probable not post-tip Questionable when game started", () => {
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
      ...kat("Questionable"),
      gameId: "401909319",
      reportTime: "2026-11-26T01:00:00Z",
      updatedAt: "2026-11-26T01:00:00Z",
    };
    const rows = injuriesForBadges([postTip], {
      slate: [nykCle],
      previous: [earlier, later],
      now: new Date("2026-11-26T00:35:00Z"),
    });
    expect(rows.find((r) => r.playerId === "3136195")?.status).toBe("Probable");
  });
});