import { describe, expect, it } from "vitest";
import { dedupeInjuryReportsByTime } from "../scripts/supabase-sync";
import type { InjuryEntry } from "../lib/types";

describe("dedupeInjuryReportsByTime", () => {
  it("collapses duplicate sync rows sharing report minute", () => {
    const base: InjuryEntry = {
      playerId: "1",
      playerName: "A",
      teamId: "t",
      teamName: "T",
      gameId: "g",
      status: "Out",
      source: "ESPN",
      updatedAt: "2026-11-25T10:00:00.000Z",
    };
    const dup = { ...base, status: "Questionable" as const };
    const out = dedupeInjuryReportsByTime([base, dup]);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("Questionable");
  });
});