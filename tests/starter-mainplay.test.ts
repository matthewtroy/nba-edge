import { describe, it, expect } from "vitest";
import { qualifiesStarter, startsInLastFive, isMainPlayStatLine } from "../lib/starter-eligibility";
import { qualifiesMainPlayLeg } from "../lib/multis";
import type { PickLeg, PlayerGameLog } from "../lib/types";

function log(
  partial: Partial<PlayerGameLog> & Pick<PlayerGameLog, "date">
): PlayerGameLog {
  return {
    gameId: "g",
    minutes: 32,
    pts: 20,
    reb: 5,
    ast: 5,
    threes: 1,
    ...partial,
  };
}

describe("starter main lines", () => {
  it("requires 24+ min and 4/5 ESPN boxscore starts", () => {
    const fourStarts: PlayerGameLog[] = [
      log({ date: "2026-01-05", started: true }),
      log({ date: "2026-01-04", started: true }),
      log({ date: "2026-01-03", started: true }),
      log({ date: "2026-01-02", started: true }),
      log({ date: "2026-01-01", started: false, minutes: 8 }),
    ];
    expect(startsInLastFive(fourStarts)).toBe(4);
    expect(qualifiesStarter(fourStarts, 28)).toBe(true);
    expect(qualifiesStarter(fourStarts, 23)).toBe(false);
  });

  it("excludes bench 0/5 starts", () => {
    const bench: PlayerGameLog[] = [
      log({ date: "2026-01-05", started: false, minutes: 14 }),
      log({ date: "2026-01-04", started: false, minutes: 12 }),
      log({ date: "2026-01-03", started: false, minutes: 18 }),
      log({ date: "2026-01-02", started: false, minutes: 10 }),
      log({ date: "2026-01-01", started: false, minutes: 16 }),
    ];
    expect(startsInLastFive(bench)).toBe(0);
    expect(qualifiesStarter(bench, 28)).toBe(false);
  });

  it("allows 4/5 started when fifth was bench", () => {
    const mixed: PlayerGameLog[] = [
      log({ date: "2026-01-05", started: true }),
      log({ date: "2026-01-04", started: true }),
      log({ date: "2026-01-03", started: true }),
      log({ date: "2026-01-02", started: true }),
      log({ date: "2026-01-01", started: false, minutes: 6 }),
    ];
    expect(qualifiesStarter(mixed, 26)).toBe(true);
  });

  it("rejects 3/5 starts", () => {
    const three: PlayerGameLog[] = [
      log({ date: "2026-01-05", started: true }),
      log({ date: "2026-01-04", started: true }),
      log({ date: "2026-01-03", started: true }),
      log({ date: "2026-01-02", started: false, minutes: 8 }),
      log({ date: "2026-01-01", started: false, minutes: 8 }),
    ];
    expect(qualifiesStarter(three, 28)).toBe(false);
  });

  it("rejects 3+ reb for Main Play", () => {
    expect(isMainPlayStatLine("reb", 3)).toBe(false);
    expect(isMainPlayStatLine("reb", 5)).toBe(true);
    const leg: PickLeg = {
      id: "1",
      gameId: "g",
      team: "T",
      opponent: "O",
      playerId: "p",
      playerName: "P",
      headshotUrl: "",
      market: "reb",
      line: 3,
      probability: 0.7,
      fairPrice: 1.45,
      takeAt: 1.57,
      tags: [],
      reasons: [],
      starterEligible: true,
    };
    expect(qualifiesMainPlayLeg(leg)).toBe(false);
  });
});