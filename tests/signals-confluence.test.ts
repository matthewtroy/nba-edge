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

  it("reason line keeps two strongest under 80 chars", () => {
    const line = reasonLineFromSignals({
      PRICE: { active: true, label: "Line beats model" },
      MATCHUP: { active: true, label: "Soft defence rank 2" },
      FORM: { active: true, label: "Hit 7 of last 10" },
    });
    expect(line.length).toBeLessThanOrEqual(80);
    expect(line).toMatch(/Line beats model|Soft defence/);
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