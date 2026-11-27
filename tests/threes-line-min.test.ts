import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { isMainPlayStatLine } from "../lib/starter-eligibility";
import { gateLineViolation, isSgmMainLine } from "../lib/main-play-eligibility";
import type { PickLeg } from "../lib/types";

describe("3pm line mins removed (1+ everywhere)", () => {
  it("isMainPlayStatLine and isSgmMainLine accept 1+", () => {
    expect(isMainPlayStatLine("3pm", 1)).toBe(true);
    expect(isSgmMainLine("3pm", 1)).toBe(true);
  });

  it("gateLineViolation has no need 2+/need 4+ for 3pm", () => {
    const leg: PickLeg = {
      id: "x",
      gameId: "g",
      team: "T",
      opponent: "O",
      playerId: "p",
      playerName: "P",
      headshotUrl: "",
      market: "3pm",
      line: 1,
      probability: 0.6,
      fairPrice: 1.7,
      takeAt: 1.8,
      tags: [],
      reasons: [],
      starter: true,
      starterEligible: true,
    };
    expect(gateLineViolation(leg, false)).toBeNull();
    expect(gateLineViolation(leg, false, { mainPlay: true })).toBeNull();
  });

  it("repo source no longer requires need 2+ / need 4+ 3pm mins", () => {
    const files = [
      "lib/main-play-eligibility.ts",
      "lib/starter-eligibility.ts",
    ];
    for (const f of files) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf8");
      expect(src).not.toMatch(/need 2\+/);
      expect(src).not.toMatch(/need 4\+/);
      expect(src).not.toMatch(/line >= 4/);
      expect(src).not.toMatch(/opts\?\.mainPlay \? 2 : 4/);
    }
  });
});
