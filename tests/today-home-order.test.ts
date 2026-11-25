import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("Today home card order", () => {
  it("Cross-Game SGM follows Q1 Multi on Home (not renamed Best Double Up)", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/screens/TodayScreen.tsx"),
      "utf8"
    );
    const match = src.match(/const ORDER = \[([\s\S]*?)\] as const/);
    expect(match).toBeTruthy();
    const order = match![1];
    const mainIdx = order.indexOf('"mainPlay"');
    const boosterIdx = order.indexOf('"booster"');
    const q1Idx = order.indexOf('"q1Multi"');
    const crossIdx = order.indexOf('"crossGameSgm"');
    expect(mainIdx).toBeGreaterThan(-1);
    expect(boosterIdx).toBeGreaterThan(mainIdx);
    expect(q1Idx).toBeGreaterThan(boosterIdx);
    expect(crossIdx).toBeGreaterThan(q1Idx);
    expect(src).not.toMatch(/Best Double Up/);
  });
});
