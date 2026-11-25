import { describe, expect, it } from "vitest";
import {
  OFFICIAL_CARD_BOOKIE,
  hasAuPropPrices,
  isEveningSydney,
  shouldPublishOfficialCard,
  sydneyHour,
} from "../lib/official-card-time";
import type { OfficialCardFile } from "../lib/official-card-time";
import type { PickLeg } from "../lib/types";

const legWithAu = {
  id: "1",
  takeAt: 1.5,
  bestPrice: 2.0,
  tags: [],
} as PickLeg;

describe("official card publish", () => {
  it("evening window is 21–01 Sydney", () => {
    const utc = new Date("2026-01-15T10:00:00Z");
    expect(sydneyHour(utc)).toBeGreaterThanOrEqual(21);
    expect(isEveningSydney(utc)).toBe(true);
  });

  it("publishes first evening run with AU props", () => {
    const now = new Date("2026-01-15T10:00:00Z");
    expect(
      shouldPublishOfficialCard(now, [legWithAu], null, "2026-01-15")
    ).toBe(true);
  });

  it("does not overwrite existing slate lock", () => {
    const now = new Date("2026-01-15T11:00:00Z");
    const existing: OfficialCardFile = {
      lockedAt: "x",
      slateDate: "2026-01-15",
      bookie: "bet365",
      multis: [],
      notBuilt: [],
      whatChanged: [],
      injuries: [],
    };
    expect(
      shouldPublishOfficialCard(now, [legWithAu], existing, "2026-01-15")
    ).toBe(false);
  });

  it("needs AU props in evening", () => {
    const now = new Date("2026-01-15T10:00:00Z");
    const bare = { id: "1", takeAt: 1.5, tags: [] } as PickLeg;
    expect(shouldPublishOfficialCard(now, [bare], null, "2026-01-15")).toBe(false);
    expect(hasAuPropPrices([legWithAu])).toBe(true);
  });

  it("has no hardcoded default bookie", () => {
    expect(OFFICIAL_CARD_BOOKIE).toBe("");
  });
});