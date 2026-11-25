import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("Cross-Game SGM label restored", () => {
  it("LABELS and settle maps use Cross-Game SGM Multi for crossGameSgm", () => {
    const multis = fs.readFileSync(path.join(process.cwd(), "lib/multis.ts"), "utf8");
    const settle = fs.readFileSync(
      path.join(process.cwd(), "lib/official-bet-settle.ts"),
      "utf8"
    );
    const filterLog = fs.readFileSync(
      path.join(process.cwd(), "lib/multi-filter-log.ts"),
      "utf8"
    );
    expect(multis).toMatch(/crossGameSgm:\s*"Cross-Game SGM Multi"/);
    expect(multis).toMatch(/label:\s*"Cross-Game SGM Multi"/);
    expect(multis).not.toMatch(/crossGameSgm:\s*"Best Double Up"/);
    expect(settle).toMatch(/crossGameSgm:\s*"Cross-Game SGM Multi"/);
    expect(filterLog).toMatch(/crossGameSgm:\s*"Cross-Game SGM Multi"/);
  });

  it("SYSTEM.md documents Cross-Game SGM not Best Double Up rename", () => {
    const sys = fs.readFileSync(path.join(process.cwd(), "docs/SYSTEM.md"), "utf8");
    expect(sys).toMatch(/### Cross-Game SGM/);
    expect(sys).toMatch(/`crossGameSgm`/);
    expect(sys).toMatch(/Cross-Game SGM Multi/);
    expect(sys).not.toMatch(/Best Double Up \(`type: crossGameSgm`\)/);
    expect(sys).not.toMatch(/Label \*\*Best Double Up\*\* \(`type: crossGameSgm`\)/);
    expect(sys).toMatch(/`doubleUp`/);
  });
});
