import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("GamesScreen", () => {
  it("does not render Cross-Game SGM multi", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/screens/GamesScreen.tsx"),
      "utf8"
    );
    expect(src).not.toMatch(/filter\(\(m\) => m\.type === "crossGameSgm"\)/);
  });
});