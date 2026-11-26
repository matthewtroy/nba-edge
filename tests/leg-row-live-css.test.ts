import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("leg row live CSS", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src/index.css"), "utf8");

  it("uses full-bleed row tint without left accent bar and 400ms fade", () => {
    expect(css).toMatch(/\.leg-row-live-full-bleed[\s\S]*margin-inline:\s*-1rem/);
    expect(css).not.toMatch(/\.leg-row-live-won[\s\S]*border-left:/);
    expect(css).not.toMatch(/\.leg-row-live-lost[\s\S]*border-left:/);
    expect(css).toMatch(/400ms ease/);
  });

  it("omits value-at-bookie track ring on progress bar", () => {
    expect(css).not.toMatch(/\.leg-progress-value-track/);
  });

  it("softens multi card live glow", () => {
    expect(css).toMatch(/\.multi-card-live-won[\s\S]*0\.05\)/);
    expect(css).toMatch(/\.multi-card-live-tracking[\s\S]*0\.04\)/);
  });
});