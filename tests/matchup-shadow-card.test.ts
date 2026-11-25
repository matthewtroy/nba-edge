import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { buildMultis } from "../lib/multis";
import { probabilityWithMatchupShadow } from "../lib/matchup-shadow";
import type { PickLeg } from "../lib/types";

import { fixtureSlateDir } from "./public-data-fixture";

const DATA = path.join(fixtureSlateDir("2026-11-26"), "picks.json");

describe("matchup shadow", () => {
  it("stores shadow p separately without changing published probability", () => {
    const shadow = probabilityWithMatchupShadow(0.6, 2);
    expect(shadow).not.toBe(0.6);
    expect(shadow).toBeGreaterThan(0.6);
    expect(shadow).toBeLessThanOrEqual(0.64);
  });

  it("does not change multis when only shadow field changes", () => {
    const picks = JSON.parse(fs.readFileSync(DATA, "utf8")) as PickLeg[];
    const pool = picks.filter((p) => p.probability >= 0.6).slice(0, 40);
    const { bets } = buildMultis(pool, 8, 300, 0.08);
    const main = bets.find((m) => m.type === "mainPlay");
    const tweaked = pool.map((p) => ({
      ...p,
      probabilityMatchupShadow: Math.min(0.95, (p.probability ?? 0.5) + 0.04),
    }));
    const { bets: bets2 } = buildMultis(tweaked, 8, 300, 0.08);
    const main2 = bets2.find((m) => m.type === "mainPlay");
    expect(main2?.legs).toEqual(main?.legs);
  });
});