import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { picksByIdFromOfficialSnapshots } from "../lib/official-leg-snapshot";
import { legsMissingAtBookie } from "../lib/single-bookie";
import { multiCardBookieHeaderLabel } from "../lib/multi-card-bookie-header";
import type { MultiBet, PickLeg } from "../lib/types";

const DATA = path.join(process.cwd(), "public/data/2026-11-26");

describe("MultiCard bookie header", () => {
  const official = JSON.parse(
    fs.readFileSync(path.join(DATA, "official-card.json"), "utf8")
  ) as { multis: MultiBet[]; legSnapshots: Record<string, unknown> };
  const picks = JSON.parse(
    fs.readFileSync(path.join(DATA, "picks.json"), "utf8")
  ) as PickLeg[];
  const main = official.multis.find((m) => m.type === "mainPlay")!;
  const legs = main.legs
    .map((id) => picksByIdFromOfficialSnapshots(official.legSnapshots, picks).get(id))
    .filter(Boolean) as PickLeg[];

  it("Unibet shows 3 of 5 priced (not missing count)", () => {
    const missing = legsMissingAtBookie(legs, "Unibet", picks);
    expect(missing).toBe(2);
    const label = multiCardBookieHeaderLabel({
      legBookie: "Unibet",
      pricedCount: legs.length - missing,
      legCount: legs.length,
    });
    expect(label).toBe("Unibet · 3 of 5");
  });

  it("Sportsbet main play shows 4 of 5 when one leg missing", () => {
    const missing = legsMissingAtBookie(legs, "Sportsbet", picks);
    const priced = legs.length - missing;
    expect(priced).toBeGreaterThanOrEqual(3);
    if (missing > 0) {
      const label = multiCardBookieHeaderLabel({
        legBookie: "Sportsbet",
        pricedCount: priced,
        legCount: legs.length,
      });
      expect(label).toMatch(/Sportsbet · \d+ of 5/);
    }
  });
});