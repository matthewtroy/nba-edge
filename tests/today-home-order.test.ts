import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("Today home card order", () => {
  it("Best Double Up (doubleUp) follows Main Play; Cross-Game SGM keeps own slot", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/screens/TodayScreen.tsx"),
      "utf8"
    );
    const match = src.match(/const ORDER = \[([\s\S]*?)\] as const/);
    expect(match).toBeTruthy();
    const order = match![1];
    const mainIdx = order.indexOf('"mainPlay"');
    const doubleIdx = order.indexOf('"doubleUp"');
    const boosterIdx = order.indexOf('"booster"');
    const crossIdx = order.indexOf('"crossGameSgm"');
    expect(mainIdx).toBeGreaterThan(-1);
    expect(doubleIdx).toBeGreaterThan(mainIdx);
    expect(boosterIdx).toBeGreaterThan(doubleIdx);
    expect(crossIdx).toBeGreaterThan(boosterIdx);
  });
});
