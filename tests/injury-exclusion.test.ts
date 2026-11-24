import { describe, it, expect } from "vitest";
import { isPlayerExcluded, injuriesByPlayerId } from "../lib/player-eligibility";
import { normalizePlayerName } from "../lib/player-names";
import type { InjuryEntry } from "../lib/types";

describe("injury exclusion", () => {
  it("excludes Out player matched by normalised name via injury map", () => {
    const injuries: InjuryEntry[] = [
      {
        playerId: "999",
        playerName: "Nikola Jokic",
        teamId: "7",
        teamName: "Denver Nuggets",
        gameId: "g1",
        status: "Out",
        source: "ESPN",
        updatedAt: "",
      },
    ];
    const pdfName = "Nikola Jokić";
    const rosterIdByName = new Map([[normalizePlayerName(pdfName), "3032977"]]);
    const byId = new Map<string, InjuryEntry>();
    const resolvedId = rosterIdByName.get(normalizePlayerName(pdfName))!;
    byId.set(resolvedId, { ...injuries[0], playerId: resolvedId, playerName: pdfName });

    const excluded = isPlayerExcluded({
      playerId: resolvedId,
      playerName: pdfName,
      teamId: "7",
      gameLogs: [
        { gameId: "a", minutes: 34, pts: 25, reb: 12, ast: 9, threes: 1, date: "2025-01-01" },
        { gameId: "b", minutes: 35, pts: 28, reb: 10, ast: 8, threes: 2, date: "2025-01-02" },
        { gameId: "c", minutes: 36, pts: 30, reb: 11, ast: 10, threes: 1, date: "2025-01-03" },
      ],
      injuriesByPlayer: byId,
      rosterIds: new Set([resolvedId]),
      returningPlayerIds: new Set(),
    });
    expect(excluded).toBe(true);
    expect(injuriesByPlayerId([...byId.values()]).size).toBe(1);
  });
});