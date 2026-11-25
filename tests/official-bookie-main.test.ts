import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { picksByIdFromOfficialSnapshots } from "../lib/official-leg-snapshot";
import { combinedPriceForBookieWithCatalog, legsMissingAtBookie } from "../lib/single-bookie";
import type { MultiBet, PickLeg } from "../lib/types";
import type { OfficialLegSnapshot } from "../lib/official-card-time";

const DATA = path.join(process.cwd(), "public/data/2026-11-26");

describe("official main play bookie totals", () => {
  const official = JSON.parse(
    fs.readFileSync(path.join(DATA, "official-card.json"), "utf8")
  ) as {
    legSnapshots: Record<string, OfficialLegSnapshot>;
    multis: MultiBet[];
  };
  const picks = JSON.parse(
    fs.readFileSync(path.join(DATA, "picks.json"), "utf8")
  ) as PickLeg[];
  const main = official.multis.find((m) => m.type === "mainPlay")!;
  const legs = main.legs
    .map((id) => picksByIdFromOfficialSnapshots(official.legSnapshots, picks).get(id))
    .filter(Boolean) as PickLeg[];

  it("Ladbrokes and Neds main play $11.59 (republished 2026-11-26)", () => {
    const lad = combinedPriceForBookieWithCatalog(legs, "Ladbrokes", picks);
    const neds = combinedPriceForBookieWithCatalog(legs, "Neds", picks);
    expect(lad).toBeCloseTo(11.59, 2);
    expect(neds).toBeCloseTo(11.59, 2);
  });

  it("Unibet incomplete on Coward and Diabaté", () => {
    const missing = legsMissingAtBookie(legs, "Unibet", picks);
    expect(missing).toBe(2);
    const total = combinedPriceForBookieWithCatalog(legs, "Unibet", picks);
    expect(total).toBeUndefined();
  });

  it("longshot at Unibet does not nearest-shift to $3.61", () => {
    const long = official.multis.find((m) => m.type === "longshot");
    expect(long).toBeTruthy();
    const longLegs = long!.legs
      .map((id) => picks.find((p) => p.id === id))
      .filter(Boolean) as PickLeg[];
    const total = combinedPriceForBookieWithCatalog(longLegs, "Unibet", picks, {
      allowNearest: false,
    });
    expect(total).not.toBeCloseTo(3.61, 2);
    expect(total).toBeUndefined();
  });
});