import { describe, expect, it } from "vitest";
import { resolveOddsLastPulled } from "../lib/odds-pull-meta";
import type { PickLeg } from "../lib/types";

describe("resolveOddsLastPulled", () => {
  it("picks latest timestamp", () => {
    const picks = [{ oddsPulledAt: "2026-11-25T01:00:00.000Z" } as PickLeg];
    const latest = resolveOddsLastPulled(
      picks,
      "2026-11-24T22:58:43.102Z",
      "2026-11-24T23:00:00.000Z"
    );
    expect(latest).toBe("2026-11-25T01:00:00.000Z");
  });
});