import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("SYSTEM.md rewrite", () => {
  it("is dated 2026-11-26 and documents doubleUp vs crossGameSgm", () => {
    const sys = fs.readFileSync(path.join(process.cwd(), "docs/SYSTEM.md"), "utf8");
    expect(sys).toMatch(/\*\*Dated:\*\* 2026-11-26/);
    expect(sys).toMatch(/`doubleUp`/);
    expect(sys).toMatch(/Cross-Game SGM Multi/);
    expect(sys).toMatch(/requiredEdge\(total\)/);
    expect(sys).toMatch(/3pm ≥1/);
    expect(sys).not.toMatch(/Label \*\*Best Double Up\*\* \(`type: crossGameSgm`\)/);
  });
});
