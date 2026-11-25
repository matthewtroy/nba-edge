import { describe, expect, it } from "vitest";
import {
  confluenceFromSignals,
  mainPlayConfluenceOk,
  reasonLineFromSignals,
} from "../lib/signals";
import type { PickLeg } from "../lib/types";

describe("signals confluence", () => {
  it("counts four active pillars", () => {
    const c = confluenceFromSignals({
      PRICE: { active: true },
      MATCHUP: { active: true },
      FORM: { active: false },
      ANGLE: { active: true },
    });
    expect(c).toBe(3);
  });

  it("reason line keeps two strongest under 70 chars", () => {
    const line = reasonLineFromSignals({
      PRICE: { active: true, label: "edge" },
      MATCHUP: { active: true, label: "D#2" },
      FORM: { active: true, label: "L10 70%" },
    });
    expect(line.length).toBeLessThanOrEqual(70);
    expect(line).toContain("edge");
  });

  it("main play requires PRICE and one other", () => {
    const leg = {
      confluence: 2,
      signals: { PRICE: { active: true }, FORM: { active: true } },
    } as PickLeg;
    expect(mainPlayConfluenceOk(leg)).toBe(true);
    const bad = { confluence: 2, signals: { MATCHUP: { active: true }, FORM: { active: true } } } as PickLeg;
    expect(mainPlayConfluenceOk(bad)).toBe(false);
  });
});