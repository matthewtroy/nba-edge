import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("useLiveTracking snapshot reuse", () => {
  it("memoizes leg views on stableSnapshotKey", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/hooks/useLiveTracking.ts"),
      "utf8"
    );
    expect(src).toContain("stableSnapshotKey");
    expect(src).toMatch(/useMemo[\s\S]*liveViewsForLegs/);
    expect(src).toMatch(/\[legs, slate, snapshotKey, snapshot\]/);
  });
});