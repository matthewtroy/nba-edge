import { describe, expect, it } from "vitest";
import {
  blendProjectedWithTeammateReturn,
  teammateReturnProbability,
} from "../lib/role-risk";
import {
  isSupportiveReason,
} from "../lib/leg-reason-supportive";
import { inferReasonType } from "../lib/leg-reason-types";
import { legReasonLineUi } from "../src/lib/leg-reason-ui";
import type { PickLeg } from "../lib/types";
import type { ProjectedStats } from "../lib/baseline";

const base: ProjectedStats = {
  pts: 12,
  reb: 5,
  ast: 2,
  threes: 1.5,
  minutes: 28,
};

describe("role risk blend", () => {
  it("uses Q/D/P return probabilities 50/25/75%", () => {
    expect(teammateReturnProbability("Questionable")).toBe(0.5);
    expect(teammateReturnProbability("Doubtful")).toBe(0.25);
    expect(teammateReturnProbability("Probable")).toBe(0.75);
  });

  it("blends baseline with out scenario by return weight", () => {
    const out: ProjectedStats = { ...base, pts: 20, reb: 8 };
    const q = blendProjectedWithTeammateReturn(base, out, 0.5);
    expect(q.pts).toBeCloseTo(16, 5);
    expect(q.reb).toBeCloseTo(6.5, 5);
    const d = blendProjectedWithTeammateReturn(base, out, 0.25);
    expect(d.pts).toBeCloseTo(18, 5);
    const p = blendProjectedWithTeammateReturn(base, out, 0.75);
    expect(p.pts).toBeCloseTo(14, 5);
  });

  it("role risk note is not supportive", () => {
    const leg: PickLeg = {
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
      reasons: [{ type: "roleRisk", text: "Role risk: Wemby questionable → +1.1 pts" }],
    };
    expect(isSupportiveReason(leg.reasons[0], leg)).toBe(false);
    expect(
      leg.reasons.every((r) => !isSupportiveReason(r, leg))
    ).toBe(true);
    expect(inferReasonType("Role risk: Wemby questionable → +1.1 pts")).toBe("roleRisk");
    expect(legReasonLineUi("Role risk: Wemby questionable → +1.1 pts").className).toMatch(
      /amber/
    );
  });
});