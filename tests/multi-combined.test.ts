import { describe, expect, it } from "vitest";
import { combinedFairAndTakeAt } from "../lib/multi-combined";
import type { PickLeg } from "../lib/types";

const legs: PickLeg[] = [
  { probability: 0.5 } as PickLeg,
  { probability: 0.5 } as PickLeg,
  { probability: 0.5 } as PickLeg,
  { probability: 0.5 } as PickLeg,
];

describe("combined multi take-at", () => {
  it("uses fair × (1 + minEdge), not leg product", () => {
    const { fair, takeAt } = combinedFairAndTakeAt(legs, 0.08);
    expect(fair).toBe(16);
    expect(takeAt).toBe(17.28);
  });

  it("take-at is fair × 1.08 rounded", () => {
    const fair = 5.21;
    const takeAt = Math.round(fair * 1.08 * 100) / 100;
    expect(takeAt).toBe(5.63);
    const sample: PickLeg[] = [{ probability: 1 / fair } as PickLeg];
    expect(combinedFairAndTakeAt(sample).takeAt).toBe(takeAt);
  });
});