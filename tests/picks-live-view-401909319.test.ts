import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { parseBoxscore } from "../scripts/espn-parse";
import type { OfficialCardFile } from "../lib/official-card-time";
import type { PickLeg, SlateGame } from "../lib/types";
import { officialLiveTrackingInputs } from "../lib/official-live-tracking";
import { liveViewsForLegs } from "../lib/live-tracking";
import type { LiveSourceSnapshot } from "../lib/live-source";

const fixtureDir = path.join(process.cwd(), "tests/fixtures");
const PICK_ID = "6585-pts-5";

const summary = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "espn/summary-401909319.json"), "utf8")
);
const official = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "2026-11-26/official-card.json"), "utf8")
) as OfficialCardFile;
const slate = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "2026-11-26/slate.json"), "utf8")
) as SlateGame[];
const picks = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "2026-11-26/picks.json"), "utf8")
) as PickLeg[];

describe("picks live view 401909319", () => {
  it("gives a settled view to a picks row not on the official card", () => {
    expect(official.legSnapshots[PICK_ID]).toBeUndefined();
    const pick = picks.find((p) => p.id === PICK_ID);
    expect(pick?.gameId).toBe("401909319");

    const { slate: pollSlate, legs } = officialLiveTrackingInputs(
      "2026-11-26",
      slate,
      picks,
      official
    );
    expect(legs.some((l) => l.id === PICK_ID)).toBe(true);

    const boxes = parseBoxscore(summary);
    const boxesByGame = new Map([["401909319", boxes]]);
    const snap: LiveSourceSnapshot = {
      fetchedAt: "2026-11-26T12:00:00.000Z",
      games: [
        {
          gameId: "401909319",
          phase: "final",
          period: 4,
          statusDetail: "Final",
        },
      ],
      boxesByGame,
    };

    const finalSlate = pollSlate.map((g) =>
      g.id === "401909319" ? { ...g, status: "final" as const } : g
    );
    const views = liveViewsForLegs(legs, finalSlate, snap);
    const view = views.get(PICK_ID);
    expect(view, PICK_ID).toBeDefined();
    expect(view?.state).toMatch(/won|lost/);
    expect(view?.actual).not.toBeNull();
  });
});