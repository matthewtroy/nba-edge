import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("Today home card order", () => {
  it("Best Double Up follows Main Play on Home", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/screens/TodayScreen.tsx"),
      "utf8"
    );
    const match = src.match(
      /const ORDER = \[([\s\S]*?)\] as const/
    );
    expect(match).toBeTruthy();
    const order = match![1];
    const mainIdx = order.indexOf('"mainPlay"');
    const crossIdx = order.indexOf('"crossGameSgm"');
    const boosterIdx = order.indexOf('"booster"');
    expect(mainIdx).toBeGreaterThan(-1);
    expect(crossIdx).toBeGreaterThan(mainIdx);
    expect(boosterIdx).toBeGreaterThan(crossIdx);
  });
});