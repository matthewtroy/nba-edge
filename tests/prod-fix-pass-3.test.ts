import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  bookieHighProbMeetsFair,
  bookiePriceMeetsMinEdge,
  officialStakeUnits,
  STAKE_UNIT_STEP,
} from "../lib/pricing-config";
import { legMeetsBookieEdge } from "../lib/bookie-edge-pool";
import { applyManualOfficialBets, loadManualOfficialBets } from "../lib/manual-official-bets";
import { buildMultis } from "../lib/multis";
import type { PickLeg } from "../lib/types";

describe("prod fix pass 3 — edge rule", () => {
  it("uses flat 8% edge only (no 6% @ 70%)", () => {
    const fair = 2;
    const leg = {
      fairPrice: fair,
      probability: 0.65,
      bookiePrices: { Sportsbet: 2.11 },
    } as PickLeg;
    expect(bookiePriceMeetsMinEdge(2.11, fair)).toBe(false);
    expect(legMeetsBookieEdge(leg, "Sportsbet", 0.08)).toBe(false);
    expect(bookieHighProbMeetsFair(2.05, fair, 0.75)).toBe(true);
    expect(
      legMeetsBookieEdge(
        { ...leg, probability: 0.75, bookiePrices: { Sportsbet: 2.05 } },
        "Sportsbet",
        0.08
      )
    ).toBe(true);
  });

  it("high-prob bypass needs price >= fair not 97% of fair", () => {
    expect(bookieHighProbMeetsFair(1.95, 2, 0.72)).toBe(false);
    expect(bookieHighProbMeetsFair(2, 2, 0.72)).toBe(true);
  });
});

describe("prod fix pass 3 — unit staking", () => {
  it("stake bands snap to 0.05u", () => {
    expect(STAKE_UNIT_STEP).toBe(0.05);
    expect(officialStakeUnits(7.5)).toBe(0.5);
  });
});

describe("prod fix pass 3 — manual Best SGM bet365", () => {
  it("config overrides boostSgm bookie for 2026-11-26", () => {
    const file = loadManualOfficialBets(process.cwd());
    expect(file.slates?.["2026-11-26"]?.boostSgm?.bestBookie).toBe("bet365");
    const multis = applyManualOfficialBets("2026-11-26", [
      {
        type: "boostSgm",
        label: "Best SGM",
        legs: ["a"],
        combinedProbability: 0.2,
        combinedFairPrice: 5,
        combinedTakeAt: 5.4,
        bestBookie: "Picklebet",
        bestBookieTotal: 7.2,
        summary: "x",
      },
    ]);
    expect(multis[0].bestBookie).toBe("bet365");
  });
});

describe("prod fix pass 3 — zero-reason legs", () => {
  it("excludes Peyton Watson reb 7 from multis pool", () => {
    const picks = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "tests/fixtures/2026-11-26/picks.json"), "utf8")
    ) as PickLeg[];
    const watson = picks.find((p) => p.id === "4576087-reb-7");
    expect(watson?.reasons?.length ?? 0).toBe(0);
    const { bets } = buildMultis(picks, 4);
    for (const b of bets) {
      expect(b.legs).not.toContain("4576087-reb-7");
    }
  });
});

describe("prod fix pass 3 — UI wiring", () => {
  it("picks list uses ui.card container (no -mx-4 bleed)", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/screens/PicksScreen.tsx"), "utf8");
    expect(src).toMatch(/ui\.card[\s\S]*picks-leg-list/);
    expect(src).not.toMatch(/picks-leg-list[\s\S]*-mx-4/);
  });

  it("Settings UI removed from App", () => {
    const app = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf8");
    expect(app).not.toContain("SettingsSheet");
    expect(app).not.toContain("useSettings");
  });

  it("TabBar has five tabs", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/components/TabBar.tsx"), "utf8");
    expect(src).toMatch(/today/);
    expect(src).toMatch(/picks/);
    expect(src).toMatch(/games/);
    expect(src).toMatch(/injuries/);
    expect(src).toMatch(/results/);
  });

  it("BetProgress supports compact thin bar", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/components/BetProgress.tsx"), "utf8");
    expect(src).toMatch(/compact/);
    expect(src).toMatch(/h-1/);
    expect(src).toMatch(/text-\[9px\]/);
  });

  it("pipeline does not swallow settle errors", () => {
    const pipe = fs.readFileSync(path.join(process.cwd(), "scripts/pipeline.ts"), "utf8");
    expect(pipe).not.toMatch(/settle step failed/);
  });

  it("reasonsAtTip refresh in slate bundle", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "scripts/slate-bundle.ts"), "utf8");
    expect(src).toMatch(/reasonsAtTip/);
    expect(src).toMatch(/freezeTippedSlate/);
  });
});