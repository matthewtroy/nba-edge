import { describe, expect, it } from "vitest";
import { injuryAlertsSinceLock } from "../lib/injury-alerts";
import type { InjuryEntry } from "../lib/types";

const base = (over: Partial<InjuryEntry>): InjuryEntry => ({
  playerId: "p1",
  playerName: "Test Player",
  teamId: "t1",
  teamName: "Team",
  gameId: "g1",
  status: "Available",
  source: "ESPN",
  updatedAt: "2026-01-01",
  ...over,
});

describe("injuryAlertsSinceLock", () => {
  it("flags worsening status", () => {
    const locked = [base({ status: "Questionable" })];
    const current = [base({ status: "Doubtful" })];
    const alerts = injuryAlertsSinceLock(locked, current);
    expect(alerts[0]).toContain("Doubtful");
  });

  it("empty when no lock snapshot", () => {
    expect(injuryAlertsSinceLock(undefined, [base({ status: "Out" })])).toEqual([]);
  });
});