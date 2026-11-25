import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import type { PickLeg, SlateGame } from "../lib/types";
import { buildMultis } from "../lib/multis";
import { pickMultiLegSubsetResolved } from "../lib/same-game-leg-resolve";
import { multiHasClash } from "../lib/clash";
import { DEFAULT_MIN_EDGE } from "../lib/multi-combined";

import { fixtureSlateDir } from "./public-data-fixture";

const DATA = fixtureSlateDir("2026-11-26");

function loadSlate(): { picks: PickLeg[]; games: SlateGame[]; size: number } {
  const picks = JSON.parse(
    fs.readFileSync(path.join(DATA, "picks.json"), "utf8")
  ) as PickLeg[];
  const games = JSON.parse(
    fs.readFileSync(path.join(DATA, "slate.json"), "utf8")
  ) as SlateGame[];
  return { picks, games, size: games.length };
}

describe("2026-11-26 cross / best SGM clash resolve", () => {
  it("resolves Larsson vs Mitchell pts same team (MIA @ PHI)", () => {
    const picks = JSON.parse(
      fs.readFileSync(path.join(DATA, "picks.json"), "utf8")
    ) as PickLeg[];
    const larsson = picks.find((p) => p.id === "4601025-pts-10");
    const mitchell = picks.find((p) => p.id === "4278053-pts-15");
    expect(larsson).toBeTruthy();
    expect(mitchell).toBeTruthy();
    const pool = [
      larsson!,
      mitchell!,
      ...picks.filter(
        (p) =>
          p.gameId === larsson!.gameId &&
          p.id !== larsson!.id &&
          p.id !== mitchell!.id &&
          (p.bestPrice ?? 0) >= 1.3
      ).slice(0, 6),
    ];
    const subset = pickMultiLegSubsetResolved(pool, 2, 3, 1.3);
    expect(subset).not.toBeNull();
    expect(multiHasClash(subset!)).toBe(false);
  });

  it("resolves Watson reb vs KAT opp pts", () => {
    const picks = JSON.parse(
      fs.readFileSync(path.join(DATA, "picks.json"), "utf8")
    ) as PickLeg[];
    const kat = picks.find(
      (p) => p.playerName === "Karl-Anthony Towns" && p.market === "pts" && p.line === 20
    );
    const watson = picks.find(
      (p) => p.playerName === "Peyton Watson" && p.market === "reb" && p.line === 5
    );
    expect(kat).toBeTruthy();
    expect(watson).toBeTruthy();
    const gameId = kat!.gameId;
    const pool = [
      kat!,
      watson!,
      ...picks.filter(
        (p) =>
          p.gameId === gameId &&
          p.id !== kat!.id &&
          p.id !== watson!.id &&
          (p.bestPrice ?? 0) >= 1.3 &&
          p.starterEligible
      ).slice(0, 12),
    ];
    const subset = pickMultiLegSubsetResolved(pool, 2, 4, 1.3);
    expect(subset).not.toBeNull();
    expect(multiHasClash(subset!)).toBe(false);
    if (subset!.some((l) => l.id === kat!.id) && subset!.some((l) => l.id === watson!.id)) {
      expect(kat!.probability).toBeGreaterThan(watson!.probability);
    }
  });

  it("builds Cross-Game SGM and Best SGM on tonight slate", () => {
    const { picks, games, size } = loadSlate();
    const { bets, notBuilt } = buildMultis(
      picks,
      size,
      300,
      DEFAULT_MIN_EDGE,
      [],
      undefined,
      games
    );
    expect(
      notBuilt.some((n) => n.type === "crossGameSgm" && /Clash rule/i.test(n.reason))
    ).toBe(false);
    expect(
      notBuilt.some((n) => n.type === "boostSgm" && /Clash rule/i.test(n.reason))
    ).toBe(false);
    const cross = bets.find((m) => m.type === "crossGameSgm");
    const best = bets.find((m) => m.type === "boostSgm");
    expect(cross).toBeDefined();
    expect(best).toBeDefined();
    expect(cross!.legs.length).toBeGreaterThanOrEqual(2);
    const crossTotal = cross!.bestBookieTotal ?? 0;
    expect(crossTotal).toBeGreaterThanOrEqual(15);
    expect(crossTotal).toBeLessThanOrEqual(50);
    expect(best!.legs.length).toBeGreaterThanOrEqual(2);
    expect(best!.legs.length).toBeLessThanOrEqual(5);
    expect(best!.bestBookieTotal ?? 0).toBeGreaterThanOrEqual(2);
  });
});