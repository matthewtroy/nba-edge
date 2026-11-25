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
    const dup = { ...base, updatedAt: "2026-11-25T10:30:00.000Z" };
    const { rows, dropped } = dedupeInjuryReportsByTime([base, dup]);
    expect(rows).toHaveLength(1);
    expect(dropped).toBe(1);
    expect(rows[0].updatedAt).toBe("2026-11-25T10:30:00.000Z");
  });
});