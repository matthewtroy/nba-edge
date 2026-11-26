import { describe, expect, it } from "vitest";
import type { MultiBet, PickLeg, SlateGame } from "../lib/types";
import {
  applySlateTipFreeze,
  freezePicksAfterTip,
  mergeSlateGamesOnRefresh,
} from "../lib/slate-tip-freeze";

const game = (
  id: string,
  startTime: string,
  status: string
): SlateGame => ({
  id,
  startTime,
  startTimeSydney: "9pm",
  homeTeam: "H",
  awayTeam: "A",
  homeTeamId: "h",
  awayTeamId: "a",
  homeB2B: false,
  awayB2B: false,
  status,
});

const leg = (
  id: string,
  gameId: string,
  extra: Partial<PickLeg> = {}
): PickLeg => ({
  id,
  gameId,
  team: "T",
  opponent: "O",
  playerId: `p-${id}`,
  playerName: "Player",
  headshotUrl: "",
  market: "pts",
  line: 20,
  probability: 0.6,
  fairPrice: 1.6,
  takeAt: 1.7,
  tags: [],
  reasons: [{ type: "avg", text: "reason kept" }],
  ...extra,
});

describe("slate tip freeze", () => {
  it("merge keeps started/final games when refresh omits them", () => {
    const prev = [
      game("g1", "2026-11-26T10:00:00Z", "scheduled"),
      game("g2", "2026-11-26T12:00:00Z", "scheduled"),
    ];
    const incoming = [game("g1", "2026-11-26T10:00:00Z", "live")];
    const now = new Date("2026-11-26T10:05:00Z");
    const merged = mergeSlateGamesOnRefresh(prev, incoming, now);
    expect(merged.map((g) => g.id).sort()).toEqual(["g1", "g2"]);
    expect(merged.find((g) => g.id === "g1")?.status).toBe("live");
  });

  it("odds gone post-tip keeps legs, reasons, and prices", () => {
    const slate = [game("g1", "2026-11-26T10:00:00Z", "live")];
    const now = new Date("2026-11-26T10:05:00Z");
    const prev = [
      leg("l1", "g1", {
        bestPrice: 1.95,
        bestBookie: "Ladbrokes",
        reasons: [{ type: "injury", text: "frozen reason" }],
      }),
    ];
    const incoming = [
      leg("l1", "g1", {
        bestPrice: undefined,
        bestBookie: undefined,
        reasons: [],
      }),
    ];
    const frozen = freezePicksAfterTip(prev, incoming, slate, now);
    expect(frozen[0].bestPrice).toBe(1.95);
    expect(frozen[0].reasons[0]?.text).toBe("frozen reason");
  });

  it("applySlateTipFreeze preserves main play total when odds vanish", () => {
    const slate = [game("g1", "2026-11-26T10:00:00Z", "live")];
    const now = new Date("2026-11-26T10:05:00Z");
    const prevPicks = [leg("l1", "g1", { bestPrice: 2.1 })];
    const nextPicks = [leg("l1", "g1")];
    const prevMulti: MultiBet = {
      type: "mainPlay",
      label: "Main",
      legs: ["l1"],
      combinedProbability: 0.6,
      combinedFairPrice: 5,
      combinedTakeAt: 5.4,
      bestBookie: "Ladbrokes",
      bestBookieTotal: 11.59,
    };
    const nextMulti: MultiBet = { ...prevMulti, bestBookieTotal: undefined };
    const out = applySlateTipFreeze({
      previousSlate: slate,
      incomingSlate: slate,
      previousPicks: prevPicks,
      incomingPicks: nextPicks,
      previousMultis: [prevMulti],
      incomingMultis: [nextMulti],
      now,
    });
    expect(out.multis[0].bestBookieTotal).toBe(11.59);
    expect(out.picks[0].bestPrice).toBe(2.1);
  });
});