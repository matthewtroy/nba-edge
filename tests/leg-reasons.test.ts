import { describe, expect, it } from "vitest";
import { buildLegReasons } from "../lib/leg-reason-builder";
import type { DefenseRatingsBundle } from "../lib/defense-ratings";
import { normalizeLegReasons, sortLegReasons } from "../lib/leg-reason-types";
import type { PickLeg } from "../lib/types";

const baseLeg = {
  id: "1",
  gameId: "g",
  team: "T",
  opponent: "O",
  playerId: "p",
  playerName: "Test",
  headshotUrl: "",
  market: "ast" as const,
  line: 5,
  probability: 0.55,
  fairPrice: 1.8,
  takeAt: 1.95,
  tags: [],
  reasons: [],
  starterEligible: true,
} as PickLeg;

describe("leg reasons structured", () => {
  it("dedupes one reason per type", () => {
    const reasons = buildLegReasons({
      leg: baseLeg,
      logs: [],
      seedReasons: [
        { type: "injury", text: "Smith out → +2.1 ast" },
        { type: "injury", text: "Duplicate injury" },
        { type: "tracking", text: "11.2 potential ast (L10)" },
      ],
    });
    expect(reasons.filter((r) => r.type === "injury").length).toBe(1);
    expect(reasons[0].type).toBe("injury");
  });

  it("does not attach pts injury to ast leg via builder seed", () => {
    const reasons = buildLegReasons({
      leg: { ...baseLeg, market: "ast" },
      logs: [],
      seedReasons: [{ type: "injury", text: "Star out → +4.0 pts" }],
    });
    expect(reasons.some((r) => r.type === "injury")).toBe(false);
  });

  it("orders injury before tracking before form", () => {
    const ordered = sortLegReasons(
      normalizeLegReasons([
        { type: "form", text: "7/10 at this line" },
        { type: "tracking", text: "11.2 potential ast (L10)" },
        { type: "injury", text: "Jones out → +1.1 ast" },
      ])
    );
    expect(ordered.map((r) => r.type)).toEqual(["injury", "form", "tracking"]);
  });

  it("formats matchup allow line with rank", () => {
    const defense: DefenseRatingsBundle = {
      defense: [
        {
          teamId: "14",
          positionBucket: "G",
          window: "last15",
          stat: "pts",
          allowedPer48: 72.7,
          rank: 1,
        },
        {
          teamId: "2",
          positionBucket: "G",
          window: "last15",
          stat: "pts",
          allowedPer48: 40,
          rank: 15,
        },
      ],
      pace: [],
      unavailable: [],
    };
    const reasons = buildLegReasons({
      leg: { ...baseLeg, market: "pts", line: 20 },
      logs: [],
      defense,
      defendingTeamId: "14",
      playerPosition: "G",
      opponentName: "Miami Heat",
    });
    const matchup = reasons.find((r) => r.type === "matchup");
    expect(matchup?.text).toMatch(/Heat allow [\d.]+ pts per game to guards/);
    expect(matchup?.text.length).toBeLessThanOrEqual(48);
    expect(matchup?.text.toLowerCase()).not.toContain("per 48");
  });

  it("keeps separate reason lines for UI", () => {
    const reasons = buildLegReasons({
      leg: baseLeg,
      logs: [],
      seedReasons: [
        { type: "injury", text: "Jones out → +1.1 ast" },
        { type: "tracking", text: "11.2 potential ast (L10)" },
      ],
    });
    expect(reasons.length).toBeGreaterThanOrEqual(2);
    expect(new Set(reasons.map((r) => r.text)).size).toBe(reasons.length);
  });
});