import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { userFacingLoadMessage } from "../lib/data-load-error";

describe("branded load copy", () => {
  it("never surfaces HTTP codes or Failed to load", () => {
    for (const kind of ["network", "missing", "unknown"] as const) {
      const msg = userFacingLoadMessage(kind);
      expect(msg).not.toMatch(/404|Failed to load/i);
    }
  });

  it("App does not render raw fetch errors", () => {
    const app = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf8");
    expect(app).not.toMatch(/text-red-400.*data\.error/);
    expect(app).not.toMatch(/Failed to load/);
  });

  it("useData maps failures to errorKind", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/hooks/useData.ts"), "utf8");
    expect(src).toMatch(/errorKind/);
    expect(src).not.toMatch(/Failed to load \$\{/);
  });
});