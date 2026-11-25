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

const FIXTURE = path.join(process.cwd(), "tests/fixtures/tonight-double-up.json");

describe("Best Double Up builder", () => {
  it("exports DOUBLE_UP_* band and extra-leg pp", () => {
    expect(DOUBLE_UP_MIN).toBe(1.8);
    expect(DOUBLE_UP_MAX).toBe(2.2);
    expect(DOUBLE_UP_EXTRA_LEG_PP).toBe(0.03);
  });

  it("builds Best Double Up from tonight fixture in $1.80–$2.20 band", () => {
    const raw = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as {
      picks: PickLeg[];
    };
    const { bets, notBuilt } = buildMultis(raw.picks, 4);
    const du = bets.find((b) => b.type === "doubleUp");
    expect(du, JSON.stringify(notBuilt.filter((n) => n.type === "doubleUp"))).toBeTruthy();
    expect(du!.label).toBe("Best Double Up");
    expect(du!.legs.length).toBeGreaterThanOrEqual(2);
    expect(du!.legs.length).toBeLessThanOrEqual(3);
    expect(du!.bestBookieTotal).toBeGreaterThanOrEqual(DOUBLE_UP_MIN);
    expect(du!.bestBookieTotal).toBeLessThanOrEqual(DOUBLE_UP_MAX);
    expect(du!.bestBookie).toBeTruthy();
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
