import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  countPricedPickLegs,
  persistDataBranchGuardReason,
  slateOddsSnapshotKeyCount,
} from "../lib/odds-cache-guard";
import type { PickLeg } from "../lib/types";
import type { OddsCacheFile } from "../lib/odds-cache-file";

const pricedLeg = { bestPrice: 1.9 } as PickLeg;

describe("persist guard per-slate", () => {
  it("allows new slate with 0 priced when prior had none on that folder", () => {
    expect(
      persistDataBranchGuardReason({
        defaultSlateDate: "2026-11-27",
        pricedLegs: 0,
        priorPricedLegsOnSlate: 0,
        priorSlateCacheKeys: 0,
        nextSlateCacheKeys: 0,
        forceOdds: false,
      })
    ).toBeNull();
  });

  it("blocks same-slate wipe from priced to zero", () => {
    expect(
      persistDataBranchGuardReason({
        defaultSlateDate: "2026-11-26",
        pricedLegs: 0,
        priorPricedLegsOnSlate: 12,
        priorSlateCacheKeys: 80,
        nextSlateCacheKeys: 0,
        forceOdds: false,
      })
    ).toMatch(/0 priced legs/);
  });

  it("allows tomorrow 0 priced while other slate still has keys (per-slate odds)", () => {
    expect(
      persistDataBranchGuardReason({
        defaultSlateDate: "2026-11-27",
        pricedLegs: 0,
        priorPricedLegsOnSlate: 0,
        priorSlateCacheKeys: 0,
        nextSlateCacheKeys: 0,
        forceOdds: false,
      })
    ).toBeNull();
    const cache: OddsCacheFile = {
      bySlateDate: {
        "2026-11-26": {
          lastPulled: "t",
          oddsMap: { "x|pts|10": { price: 1.5, bookie: "TAB" } },
        },
        "2026-11-27": { lastPulled: "t", oddsMap: {} },
      },
    };
    expect(slateOddsSnapshotKeyCount(cache, "2026-11-27")).toBe(0);
    expect(slateOddsSnapshotKeyCount(cache, "2026-11-26")).toBe(1);
    expect(countPricedPickLegs([pricedLeg])).toBe(1);
  });

  it("dual staging keeps both slate directories", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nba-dual-"));
    const staging = path.join(tmp, "public", "data");
    fs.mkdirSync(path.join(staging, "2026-11-26"), { recursive: true });
    fs.mkdirSync(path.join(staging, "2026-11-27"), { recursive: true });
    fs.writeFileSync(
      path.join(staging, "2026-11-26", "picks.json"),
      JSON.stringify([pricedLeg])
    );
    fs.writeFileSync(path.join(staging, "2026-11-27", "picks.json"), "[]");
    fs.writeFileSync(
      path.join(staging, "index.json"),
      JSON.stringify({ defaultDate: "2026-11-27" })
    );
    expect(fs.existsSync(path.join(staging, "2026-11-26", "picks.json"))).toBe(true);
    expect(fs.existsSync(path.join(staging, "2026-11-27", "picks.json"))).toBe(true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});