import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { injuryAlertsForCard } from "../lib/injury-alerts-card";
import type { InjuryEntry } from "../lib/types";

const base = (id: string, status: InjuryEntry["status"]): InjuryEntry => ({
  playerId: id,
  playerName: id,
  teamId: "t1",
  teamName: "Team",
  gameId: "g1",
  status,
  source: "espn",
  updatedAt: "2026-11-25T00:00:00Z",
});

describe("injuryAlertsForCard", () => {
  it("Today wires official card leg ids only", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/screens/TodayScreen.tsx"),
      "utf8"
    );
    expect(src).toContain("injuryAlertsForCard");
    expect(src).toContain("cardPlayerIds");
  });

  it("only alerts for players on the card", () => {
    const locked = [base("on-card", "Probable")];
    const current = [
      base("on-card", "Out"),
      base("bench", "Out"),
    ];
    const alerts = injuryAlertsForCard(locked, current, new Set(["on-card"]));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain("on-card");
    expect(alerts.some((a) => a.includes("bench"))).toBe(false);
  });
});