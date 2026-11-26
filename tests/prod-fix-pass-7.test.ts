/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import type { PickLeg } from "../lib/types";
import { legRowReasonLines } from "../lib/leg-row-reasons";
import { reasonTextHasBannedPhrase } from "../lib/reason-ban";
import { reasonCountHistogram, sampleLegsByMarket } from "../lib/reason-histogram";
import { threesVolumeFromLogs } from "../lib/player-tracking-fetch";
import { standaloneInjuryBlocks } from "../lib/injuries-standalone";
import { LEG_PROGRESS_LABEL_CLASS, LEG_PROGRESS_TRACK_CLASS } from "../lib/leg-progress-layout";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { LegProgress } from "../src/components/LegProgress";
import type { LiveLegView } from "../lib/live-leg";

const picks26 = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests/fixtures/2026-11-26/picks.json"), "utf8")
) as PickLeg[];

const picks28 = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "tests/fixtures/next-slate/2026-11-28-pre-odds.json"),
    "utf8"
  )
).picks as PickLeg[];

const injFixture = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests/fixtures/injuries/2026-11-26-a199542.json"), "utf8")
);

function liveView(actual: number, line: number, state: LiveLegView["state"]): LiveLegView {
  return {
    state,
    line,
    actual,
    playerId: "p",
    market: "pts",
    gameId: "g",
    probability: 0.5,
  };
}

describe("item 1: leg reasons house style", () => {
  it("3pm tracking uses 3PA not FGA", () => {
    const line = threesVolumeFromLogs([
      ...Array.from({ length: 5 }, (_, i) => ({
        gameId: `l5-${i}`,
        date: `2026-11-${String(20 - i).padStart(2, "0")}`,
        minutes: 30,
        pts: 18,
        reb: 4,
        ast: 3,
        threes: 3,
        fg3a: 10,
      })),
      ...Array.from({ length: 8 }, (_, i) => ({
        gameId: `s-${i}`,
        date: `2026-10-${String(28 - i).padStart(2, "0")}`,
        minutes: 28,
        pts: 12,
        reb: 3,
        ast: 2,
        threes: 1,
        fg3a: 4,
      })),
    ]);
    expect(line).toMatch(/^More 3s:/);
    expect(line).not.toMatch(/FGA/i);
  });

  for (const id of ["4683021-pts-30", "3136193-pts-25", "4066261-pts-25"]) {
    it(`display fallback for ${id} (supportive or legacy-banned only)`, () => {
      const leg = picks26.find((p) => p.id === id)!;
      expect(leg).toBeTruthy();
      const lines = legRowReasonLines(leg);
      if (lines.length === 0) {
        expect(
          (leg.reasons ?? []).every((r) => reasonTextHasBannedPhrase(String(r.text ?? r)))
        ).toBe(true);
      } else {
        expect(lines.length).toBeGreaterThanOrEqual(1);
        expect(lines.length).toBeLessThanOrEqual(3);
      }
    });
  }

});

describe("item 2: injuries standalone", () => {
  it("no date switcher or count-as-out UI", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/screens/InjuriesScreen.tsx"),
      "utf8"
    );
    expect(src).not.toContain("DateSwitcher");
    expect(src).not.toContain("useQuestionableSwaps");
    expect(src).not.toContain("count as out");
    expect(src).toContain("clearQuestionableAsOutStorage");
  });

  it("standalone blocks sort by tip and group by team", () => {
    const blocks = standaloneInjuryBlocks({
      today: {
        slate: injFixture.slate,
        injuries: injFixture.injuries,
        injuriesAtTip: injFixture.injuriesAtTip,
      },
      now: new Date("2026-11-26T10:00:00Z"),
    });
    expect(blocks.length).toBeGreaterThan(0);
    for (let i = 1; i < blocks.length; i++) {
      expect(Date.parse(blocks[i]!.tipIso)).toBeGreaterThanOrEqual(
        Date.parse(blocks[i - 1]!.tipIso)
      );
    }
  });
});

describe("item 3: progress bars equal track width", () => {
  it("LegProgress exports fixed track + label slots", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/LegProgress.tsx"),
      "utf8"
    );
    expect(src).toContain("LEG_PROGRESS_TRACK_CLASS");
    expect(src).toContain("LEG_PROGRESS_LABEL_CLASS");
    expect(LEG_PROGRESS_TRACK_CLASS).toContain("w-[160px]");
    expect(LEG_PROGRESS_LABEL_CLASS).toContain("w-[2.5rem]");
  });

  it("equal rendered track width for 3/7/18 labels", () => {
    const widths = ["3", "7", "18", "25"].map((actual) => {
      const html = renderToStaticMarkup(
        createElement(LegProgress, { view: liveView(Number(actual), 25, "live") })
      );
      const m = html.match(/data-testid="leg-progress-track"[^>]*class="([^"]+)"/);
      return m?.[1] ?? "";
    });
    expect(new Set(widths).size).toBe(1);
  });
});

describe("item 4: cross SGM gaps", () => {
  it("cross leg list uses same divide spacing as Main Play", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/components/MultiCard.tsx"), "utf8");
    expect(src).toContain("divide-y divide-white/[0.04]");
    expect(src).not.toContain("mt-4 pt-4 border-t border-white/[0.05]");
  });
});

describe("samples for deliverable", () => {
  it("exports 12 sample legs with reasons", () => {
    const samples = sampleLegsByMarket(picks28, 3);
    const flat = Object.values(samples).flat();
    expect(flat).toHaveLength(12);
    for (const leg of flat) {
      expect(legRowReasonLines(leg).length).toBeGreaterThanOrEqual(1);
    }
  });
});