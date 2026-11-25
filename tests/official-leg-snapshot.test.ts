import { describe, expect, it } from "vitest";
import {
  freezeOfficialLegSnapshots,
  pickLegFromSnapshot,
  officialCardPrimaryBookie,
} from "../lib/official-leg-snapshot";
import type { MultiBet, PickLeg } from "../lib/types";

const leg = {
  id: "a-pts-10",
  playerId: "a",
  playerName: "Test Player",
  headshotUrl: "",
  gameId: "g1",
  team: "T",
  opponent: "O",
  market: "pts",
  line: 10,
  probability: 0.6,
  fairPrice: 1.67,
  takeAt: 1.8,
  tags: [],
  reasons: [{ type: "avg", text: "L10 avg 12 pts vs 10+" }],
  reasonLine: "L10 avg 12 pts vs 10+",
  bookiePrices: { Ladbrokes: 1.62, Neds: 1.55 },
  bestBookie: "Neds",
  bestPrice: 1.55,
  starterEligible: true,
} as PickLeg;

const multi = {
  type: "mainPlay",
  label: "Main Play",
  legs: ["a-pts-10"],
  bestBookie: "Ladbrokes",
  bestBookieTotal: 1.62,
} as MultiBet;

describe("official leg snapshots", () => {
  it("freezes published Ladbrokes price per multi bestBookie", () => {
    const map = new Map([["a-pts-10", leg]]);
    const snaps = freezeOfficialLegSnapshots([multi], map, [leg]);
    expect(snaps["a-pts-10"].publishedBookie).toBe("Ladbrokes");
    expect(snaps["a-pts-10"].publishedPrice).toBe(1.62);
    const frozen = pickLegFromSnapshot(snaps["a-pts-10"]);
    expect(frozen.bestPrice).toBe(1.62);
    expect(frozen.reasons.length).toBeGreaterThan(0);
  });

  it("primary bookie from main play", () => {
    expect(officialCardPrimaryBookie([multi])).toBe("Ladbrokes");
  });
});