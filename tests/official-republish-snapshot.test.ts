import { describe, expect, it } from "vitest";
import type { MultiBet, PickLeg } from "../lib/types";
import { freezeOfficialLegSnapshots } from "../lib/official-leg-snapshot";
import { gradeOfficialLeg } from "../lib/settle-core";
import type { OfficialLegSnapshot } from "../lib/official-card-time";

function pick(id: string, line: number): PickLeg {
  return {
    id,
    gameId: "g1",
    team: "A",
    opponent: "B",
    playerId: "p1",
    playerName: "Test",
    headshotUrl: "",
    market: "pts",
    line,
    probability: 0.6,
    fairPrice: 1.7,
    takeAt: 1.85,
    tags: [],
    reasons: [],
    starterEligible: true,
    lastTenStatValues: [line, line - 1, line + 2],
  };
}

describe("republish snapshot", () => {
  it("settles on latest frozen line after republish", () => {
    const multi: MultiBet = {
      type: "mainPlay",
      label: "Main",
      legs: ["leg-v1"],
      combinedProbability: 0.6,
      combinedFairPrice: 1.7,
      combinedTakeAt: 1.85,
      bestBookie: "TAB",
    };
    const v1 = pick("leg-v1", 20);
    const snapsV1 = freezeOfficialLegSnapshots([multi], new Map([[v1.id, v1]]), [v1]);
    const upgraded = pick("leg-v1", 25);
    const snapsV2 = freezeOfficialLegSnapshots(
      [multi],
      new Map([[upgraded.id, upgraded]]),
      [upgraded]
    );

    const snap1 = snapsV1["leg-v1"];
    const snap2 = snapsV2["leg-v1"];
    expect(snap1.line).toBe(20);
    expect(snap2.line).toBe(25);
    expect(snap2.lastTenStatValues?.length).toBe(3);

    const box = { minutes: 30, pts: 22, reb: 5, ast: 3, threes: 1 };
    expect(gradeOfficialLeg(snap1 as OfficialLegSnapshot, box).result).toBe("won");
    expect(gradeOfficialLeg(snap2 as OfficialLegSnapshot, box).result).toBe("lost");
  });
});