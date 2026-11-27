import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { buildMultis } from "../lib/multis";
import {
  DOUBLE_UP_EXTRA_LEG_PP,
  DOUBLE_UP_MAX,
  DOUBLE_UP_MIN,
} from "../lib/pricing-config";
import type { PickLeg } from "../lib/types";
import { ensureSupportivePicks } from "./helpers/supportive-picks";

const FIXTURE = path.join(process.cwd(), "tests/fixtures/tonight-double-up.json");

describe("Best Double Up builder", () => {
  it("exports DOUBLE_UP_* band and extra-leg pp", () => {
    expect(DOUBLE_UP_MIN).toBe(1.8);
    expect(DOUBLE_UP_MAX).toBe(2.2);
    expect(DOUBLE_UP_EXTRA_LEG_PP).toBe(0.03);
  });

  function duLeg(id: string, gameId: string, price: number): PickLeg {
    return {
      id,
      gameId,
      team: "T",
      opponent: "O",
      playerId: id,
      playerName: id,
      headshotUrl: "",
      market: "pts",
      line: 15,
      probability: 0.75,
      fairPrice: 1.35,
      takeAt: 1.46,
      starter: true,
      starterEligible: true,
      tags: ["High probability"],
      reasons: [{ type: "form", text: "8/10 at this line" }],
      recentTenVsLine: Array(10).fill("hit"),
      bookiePrices: { Sportsbet: price },
      bestPrice: price,
      bestBookie: "Sportsbet",
    };
  }

  it("builds Best Double Up in $1.80–$2.20 band under edge-fair", () => {
    const picks = [
      { ...duLeg("a", "g1", 1.56), fairPrice: 1.42, takeAt: 1.53 },
      { ...duLeg("b", "g2", 1.41), fairPrice: 1.3, takeAt: 1.4 },
    ];
    const { bets } = buildMultis(picks, 2);
    const du = bets.find((b) => b.type === "doubleUp");
    expect(du).toBeTruthy();
    expect(du!.bestBookieTotal).toBeGreaterThanOrEqual(DOUBLE_UP_MIN);
    expect(du!.bestBookieTotal).toBeLessThanOrEqual(DOUBLE_UP_MAX);
  });

  it("tonight fixture: Double Up only when edge-fair pool supports $1.80–$2.20", () => {
    const raw = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as {
      picks: PickLeg[];
    };
    const { bets, notBuilt } = buildMultis(ensureSupportivePicks(raw.picks), 4);
    const du = bets.find((b) => b.type === "doubleUp");
    if (du) {
      expect(du.bestBookieTotal).toBeGreaterThanOrEqual(DOUBLE_UP_MIN);
      expect(du.bestBookieTotal).toBeLessThanOrEqual(DOUBLE_UP_MAX);
    } else {
      expect(
        notBuilt.some((n) => n.type === "doubleUp" && /\$1\.8–\$2\.2/.test(n.reason))
      ).toBe(true);
    }
  });

  it("is a separate type from crossGameSgm and sits after Main Play on Home", () => {
    const multis = fs.readFileSync(path.join(process.cwd(), "lib/multis.ts"), "utf8");
    expect(multis).toMatch(/doubleUp:\s*"Best Double Up"/);
    expect(multis).toMatch(/crossGameSgm:\s*"Cross-Game SGM Multi"/);
    expect(DOUBLE_UP_EXTRA_LEG_PP).toBe(0.03);
    const orderSrc = fs.readFileSync(
      path.join(process.cwd(), "src/screens/TodayScreen.tsx"),
      "utf8"
    );
    const order = orderSrc.match(/const ORDER = \[([\s\S]*?)\] as const/)![1];
    expect(order.indexOf('"doubleUp"')).toBeGreaterThan(order.indexOf('"mainPlay"'));
    expect(order.indexOf('"crossGameSgm"')).toBeGreaterThan(order.indexOf('"doubleUp"'));
  });
});
