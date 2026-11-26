import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("PicksScreen", () => {
  it("wires LegProgress on each pick row", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/screens/PicksScreen.tsx"),
      "utf8"
    );
    expect(src).toContain("PickLegRow");
    const row = fs.readFileSync(
      path.join(process.cwd(), "src/components/PickLegRow.tsx"),
      "utf8"
    );
    expect(row).toContain("LegProgress");
    expect(row).toContain("liveView");
    expect(row).toContain("leg-title-live-dot");
  });
});