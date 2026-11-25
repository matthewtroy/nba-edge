import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("LegSheet", () => {
  it("does not render Model % in the sheet", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/LegSheet.tsx"),
      "utf8"
    );
    expect(src).not.toMatch(/Model p/);
    expect(src).not.toMatch(/modelLeg\.probability/);
  });
});