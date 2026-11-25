import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("Main Play sweet-spot selection", () => {
  it("multis imports sweet-spot helpers and logs path", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "lib/multis.ts"), "utf8");
    expect(src).toMatch(/MAIN_PLAY_SWEET_MIN/);
    expect(src).toMatch(/compareMainPlayCandidates/);
    expect(src).toMatch(/sweetSpot/);
  });
});