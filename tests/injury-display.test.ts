import { describe, expect, it } from "vitest";
import type { InjuryEntry } from "../lib/types";
import {
  injuryStatusForPlayer,
  mergeInjuriesNewestFirst,
} from "../lib/injury-display";

function kat(status: InjuryEntry["status"], updatedAt: string): InjuryEntry {
  return {
    playerId: "3136195",
    playerName: "Karl-Anthony Towns",
    teamId: "18",
    teamName: "New York Knicks",
    gameId: "401909319",
    status,
    source: "NBA Official",
    updatedAt,
  };
}

describe("injury display badges", () => {
  it("uses newest updatedAt when snapshot Questionable and live Probable", () => {
    const snapshot = kat("Questionable", "2026-11-25T13:39:22.578Z");
    const live = kat("Probable", "2026-11-25T19:45:15.024Z");
    const merged = mergeInjuriesNewestFirst([live], [snapshot]);
    const status = injuryStatusForPlayer(merged, "3136195");
    expect(status).toBe("Probable");
    expect(status === "Questionable" || status === "Doubtful").toBe(false);
  });

  it("dedupes duplicate live rows by updatedAt", () => {
    const older = kat("Questionable", "2026-11-25T10:00:00.000Z");
    const newer = kat("Probable", "2026-11-25T19:45:00.000Z");
    expect(injuryStatusForPlayer([older, newer], "3136195")).toBe("Probable");
    expect(injuryStatusForPlayer([newer, older], "3136195")).toBe("Probable");
  });
});