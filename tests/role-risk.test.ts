import { describe, expect, it } from "vitest";
import {
  applyTeammateReturnRoleRisk,
  legHasNegativeRoleRisk,
  sharePlayedLast5,
  teammateReturnProbability,
} from "../lib/role-risk";
import { isSupportiveReason } from "../lib/leg-reason-supportive";
import { inferReasonType } from "../lib/leg-reason-types";
import { legReasonLineUi } from "../src/lib/leg-reason-ui";
import type { PickLeg, PlayerGameLog, PlayerProfile, InjuryEntry } from "../lib/types";
import type { TeamContext } from "../lib/injury-redistribution";
import { perMinuteRates, projectBaseline, projectedMinutes } from "../lib/baseline";

const base: PlayerGameLog = {
  gameId: "g0",
  minutes: 30,
  pts: 15,
  reb: 5,
  ast: 4,
  threes: 1,
  date: "2026-11-01",
};

function log(id: string, pts: number, withoutStar: boolean): PlayerGameLog {
  return { ...base, gameId: id, pts, minutes: withoutStar ? 32 : 28 };
}

describe("role risk EV", () => {
  it("uses Q/D/P return probabilities 50/25/75%", () => {
    expect(teammateReturnProbability("Questionable")).toBe(0.5);
    expect(teammateReturnProbability("Doubtful")).toBe(0.25);
    expect(teammateReturnProbability("Probable")).toBe(0.75);
  });

  it("sharePlayedLast5 counts minutes in last five", () => {
    const logs = [
      { ...base, gameId: "1", minutes: 30 },
      { ...base, gameId: "2", minutes: 0 },
      { ...base, gameId: "3", minutes: 28 },
      { ...base, gameId: "4", minutes: 31 },
      { ...base, gameId: "5", minutes: 29 },
    ];
    expect(sharePlayedLast5(logs)).toBeCloseTo(0.8, 5);
  });

  it("negative EV adj adds Role risk note; positive adds supportive injury line", () => {
    const star: PlayerProfile = {
      id: "star",
      name: "Dylan Harper",
      teamId: "1",
      teamName: "Team",
      position: "G",
      headshotUrl: "",
      seasonAvgMinutes: 32,
      gameLogs: [
        log("a", 18, false),
        log("b", 20, false),
        log("c", 19, false),
        log("d", 21, false),
        log("e", 22, false),
      ],
    };
    const wing: PlayerProfile = {
      id: "wing",
      name: "Julian Champagnie",
      teamId: "1",
      teamName: "Team",
      position: "F",
      headshotUrl: "",
      seasonAvgMinutes: 28,
      gameLogs: [
        log("a", 18, false),
        log("b", 19, false),
        log("c", 20, false),
        log("d", 21, false),
        log("e", 8, true),
        log("f", 9, true),
        log("g", 10, true),
      ],
    };
    const logs = new Map([
      [star.id, star.gameLogs],
      [wing.id, wing.gameLogs],
    ]);
    const rates = new Map();
    const adjusted = new Map();
    const baseStats = new Map();
    for (const p of [star, wing]) {
      const r = perMinuteRates(p.gameLogs)!;
      rates.set(p.id, r);
      const b = projectBaseline(r, projectedMinutes(p.gameLogs));
      baseStats.set(p.id, b);
      adjusted.set(p.id, { ...b });
    }
    const injury: InjuryEntry = {
      playerId: star.id,
      playerName: star.name,
      teamId: "1",
      teamName: "Team",
      gameId: "g",
      status: "Doubtful",
      source: "test",
      updatedAt: "",
    };
    const team: TeamContext = {
      players: [star, wing],
      injuries: [injury],
      gameLogsByPlayer: logs,
    };
    const reasons = new Map<string, string[]>();
    applyTeammateReturnRoleRisk(team, baseStats, rates, adjusted, reasons);
    const wingReasons = reasons.get("wing") ?? [];
    expect(wingReasons.some((r) => /^Role risk: Harper doubtful$/i.test(r))).toBe(true);
    expect(wingReasons.some((r) => /→ \+/i.test(r))).toBe(false);
  });

  it("role risk note is not supportive; positive questionable is supportive", () => {
    const legNeg: PickLeg = {
      id: "1",
      gameId: "g",
      team: "T",
      opponent: "O",
      playerId: "p",
      playerName: "P",
      headshotUrl: "",
      market: "pts",
      line: 10,
      probability: 0.7,
      fairPrice: 1.4,
      takeAt: 1.5,
      starterEligible: true,
      tags: [],
      reasons: [{ type: "roleRisk", text: "Role risk: Harper questionable" }],
    };
    expect(isSupportiveReason(legNeg.reasons[0], legNeg)).toBe(false);
    expect(legHasNegativeRoleRisk(legNeg)).toBe(true);
    expect(inferReasonType("Role risk: Harper questionable")).toBe("roleRisk");
    expect(legReasonLineUi("Role risk: Harper questionable").className).toMatch(/amber/);

    const legPos: PickLeg = {
      ...legNeg,
      reasons: [{ type: "injury", text: "Harper questionable → +1.2 pts" }],
    };
    expect(isSupportiveReason(legPos.reasons[0], legPos)).toBe(true);
    expect(legHasNegativeRoleRisk(legPos)).toBe(false);
    expect(inferReasonType("Harper questionable → +1.2 pts")).toBe("injury");
  });
});