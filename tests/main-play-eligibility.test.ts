import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import type { PickLeg } from "../lib/types";
import {
  mainPlayL10Within10pp,
  mainPlayHasValueOrHighProb,
  qualifiesMainPlayLeg,
} from "../lib/main-play-eligibility";
import { mainPlayReasonBeyondRankAvg } from "../lib/leg-display";

const DATA = path.join(process.cwd(), "public/data/2026-11-26");

function synth(overrides: Partial<PickLeg> & Pick<PickLeg, "id">): PickLeg {
  return {
    gameId: "g1",
    team: "T",
    opponent: "O",
    playerId: "p1",
    playerName: "Player",
    headshotUrl: "",
    market: "pts",
    line: 20,
    probability: 0.73,
    fairPrice: 1.45,
    takeAt: 1.57,
    tags: ["High probability"],
    reasons: [{ type: "form", text: "7/10 hits at line" }],
    starterEligible: true,
    recentTenVsLine: [
      "hit",
      "hit",
      "hit",
      "hit",
      "hit",
      "hit",
      "hit",
      "miss",
      "miss",
      "miss",
    ],
    reasonLine: "7/10 hits at line · Soft defence rank 8",
    bookiePrices: { Ladbrokes: 1.55 },
    bestBookie: "Ladbrokes",
    bestPrice: 1.55,
    ...overrides,
  };
}

describe("main play leg eligibility", () => {
  it("SGA ast 5+ on tonight slate fails Main Play rules", () => {
    const picks = JSON.parse(
      fs.readFileSync(path.join(DATA, "picks.json"), "utf8")
    ) as PickLeg[];
    const sga = picks.find((p) => p.id === "4278073-ast-5");
    expect(sga).toBeTruthy();
    expect(mainPlayHasValueOrHighProb(sga!, "Ladbrokes")).toBe(false);
    expect(mainPlayL10Within10pp(sga!)).toBe(false);
    expect(mainPlayReasonBeyondRankAvg(sga!)).toBe(true);
    expect(qualifiesMainPlayLeg(sga!, "Ladbrokes")).toBe(false);
  });

  it("passes at 73% with 7/10 hits and High prob", () => {
    const leg = synth({ id: "high" });
    expect(mainPlayL10Within10pp(leg)).toBe(true);
    expect(qualifiesMainPlayLeg(leg, "Ladbrokes")).toBe(true);
  });

  it("passes Value at 66% with 6/10 and non-rank reason", () => {
    const leg = synth({
      id: "value",
      probability: 0.66,
      tags: ["Value"],
      recentTenVsLine: [
        "hit",
        "hit",
        "hit",
        "hit",
        "hit",
        "hit",
        "miss",
        "miss",
        "miss",
        "miss",
      ],
      bookiePrices: { Ladbrokes: 1.62 },
      bestPrice: 1.62,
      takeAt: 1.58,
    });
    expect(mainPlayL10Within10pp(leg)).toBe(true);
    expect(mainPlayHasValueOrHighProb(leg, "Ladbrokes")).toBe(true);
    expect(qualifiesMainPlayLeg(leg, "Ladbrokes")).toBe(true);
  });
});