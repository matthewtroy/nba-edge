import { describe, expect, it } from "vitest";
import { resolveOddsLastPulled } from "../lib/odds-pull-meta";
import type { PickLeg } from "../lib/types";

describe("resolveOddsLastPulled", () => {
  it("prefers session pull over later leg write times", () => {
    const picks = [{ oddsPulledAt: "2026-11-25T01:00:00.000Z" } as PickLeg];
    const latest = resolveOddsLastPulled(
      picks,
      "2026-11-24T22:58:43.102Z",
      "2026-11-24T23:00:00.000Z"
    );
    expect(latest).toBe("2026-11-24T22:58:43.102Z");
  });

  it("falls back to leg times when no session pull", () => {
    const picks = [{ oddsPulledAt: "2026-11-25T01:00:00.000Z" } as PickLeg];
    expect(resolveOddsLastPulled(picks, undefined, undefined)).toBe(
      "2026-11-25T01:00:00.000Z"
    );
  });
});