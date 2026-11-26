import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("leg row live CSS", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src/index.css"), "utf8");

  it("uses softer row gradient, 2px accent, and 400ms fade", () => {
    expect(css).toMatch(/\.leg-row-live-won[\s\S]*border-left:\s*2px/);
    expect(css).toMatch(/\.leg-row-live-lost[\s\S]*border-left:\s*2px/);
    expect(css).toMatch(/400ms ease/);
  });

  it("softens multi card live glow", () => {
    expect(css).toMatch(/\.multi-card-live-won[\s\S]*0\.05\)/);
    expect(css).toMatch(/\.multi-card-live-tracking[\s\S]*0\.04\)/);
  });
});