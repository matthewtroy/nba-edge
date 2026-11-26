import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import type { OfficialCardFile } from "../lib/official-card-time";
import type { PickLeg, SlateGame } from "../lib/types";
import { officialLiveTrackingInputs } from "../lib/official-live-tracking";
import { createMockLiveProvider, buildLiveSnapshot } from "../lib/live-source";
import { liveViewsForLegs } from "../lib/live-tracking";

const fixtureDir = path.join(process.cwd(), "tests/fixtures/2026-11-26");
const official = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "official-card.json"), "utf8")
) as OfficialCardFile;
const slate = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "slate.json"), "utf8")
) as SlateGame[];
const picks = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "picks.json"), "utf8")
) as PickLeg[];
const scoreboard = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests/fixtures/espn/scoreboard-mini.json"), "utf8")
);
const summaryFinal = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests/fixtures/espn/summary-final.json"), "utf8")
);

describe("official live tracking", () => {
  it("tracks official snapshot legs missing from picks pool", async () => {
    const cardLegId = Object.keys(official.legSnapshots)[0]!;
    const trimmedPicks = picks.filter((p) => p.id !== cardLegId);
    expect(trimmedPicks.some((p) => p.id === cardLegId)).toBe(false);
    const { slate: pollSlate, legs } = officialLiveTrackingInputs(
      "2026-11-26",
      slate,
      trimmedPicks,
      official
    );
    expect(legs.some((l) => l.id === cardLegId)).toBe(true);
    expect(new Set(pollSlate.map((g) => g.id)).size).toBeGreaterThanOrEqual(
      new Set(legs.map((l) => l.gameId)).size
    );
    const provider = createMockLiveProvider({
      scoreboard,
      summaries: { "fixture-game-won": summaryFinal },
    });
    const snap = await buildLiveSnapshot(provider, pollSlate, pollSlate.map((g) => g.id));
    const views = liveViewsForLegs(legs, pollSlate, snap);
    const cardView = views.get(cardLegId);
    expect(cardView?.state).toMatch(/won|lost|live|pending|void/);
  });
});