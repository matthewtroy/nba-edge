import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("MultiCard footer", () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), "src/components/MultiCard.tsx"),
    "utf8"
  );
  const scale = fs.readFileSync(
    path.join(process.cwd(), "src/lib/card-type-scale.ts"),
    "utf8"
  );

  it("groups bookie row and Copy/Share in one footer without hairlines", () => {
    expect(src).toContain('data-testid="multi-card-footer"');
    expect(src).toContain('data-testid="multi-card-bookie-row"');
    expect(src).not.toMatch(/multi-card-bookie-row[\s\S]*border-b/);
    expect(scale).not.toMatch(/copyBtn:[\s\S]*border-t/);
    expect(src).toMatch(/flex gap-2[\s\S]*Copy[\s\S]*Share/);
  });
});