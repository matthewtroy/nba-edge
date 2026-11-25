import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("one Longshot card", () => {
  it("buildLongshot no longer emits Longshot 2/3 variants", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "lib/multis.ts"), "utf8");
    expect(src).not.toMatch(/Longshot 2/);
    expect(src).not.toMatch(/Longshot 3/);
    expect(src).toMatch(/label: "Longshot"/);
    const builtBlock = src.slice(src.indexOf("function buildLongshot"), src.indexOf("function longshotLegScore"));
    expect(builtBlock).not.toMatch(/unique\.length >= 3/);
  });
});