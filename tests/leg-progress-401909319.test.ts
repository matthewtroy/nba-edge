import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { parseBoxscore } from "../scripts/espn-parse";
import type { OfficialCardFile } from "../lib/official-card-time";
import type { SlateGame } from "../lib/types";
import { pickLegFromSnapshot } from "../lib/official-leg-snapshot";
import { liveLegView } from "../lib/live-leg";
import { legProgressRightLabel, legRowLiveTrackingClass } from "../lib/live-leg-ui";

const fixtureDir = path.join(process.cwd(), "tests/fixtures");
const summary = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "espn/summary-401909319.json"), "utf8")
);
const official = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "2026-11-26/official-card.json"), "utf8")
) as OfficialCardFile;
const slate = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "2026-11-26/slate.json"), "utf8")
) as SlateGame[];

const boxes = parseBoxscore(summary);
const finalGame: SlateGame = {
  ...slate.find((g) => g.id === "401909319")!,
  status: "final",
};

function legViewForSnap(snapId: string) {
  const snap = official.legSnapshots[snapId];
  expect(snap, snapId).toBeDefined();
  const leg = pickLegFromSnapshot(snap);
  const box = boxes.get(snap.playerId);
  expect(box, snap.playerName).toBeDefined();
  return liveLegView(leg, finalGame, box, { period: 4, statusDetail: "Final" });
}

describe("ESPN 401909319 final box — KAT / Harden / Mitchell", () => {
  it("KAT 20+ pts and 30+ pts both lose at 12", () => {
    const v20 = legViewForSnap("3136195-pts-20");
    const v30 = legViewForSnap("3136195-pts-30");
    expect(v20.state).toBe("lost");
    expect(v30.state).toBe("lost");
    expect(v20.actual).toBe(12);
    expect(legProgressRightLabel(v20)).toBe("12 ✗");
    expect(legRowLiveTrackingClass(v20)).toBe("leg-row-live-lost");
  });

  it("James Harden 20+ pts wins at 28", () => {
    const v = legViewForSnap("3992-pts-20");
    expect(v.state).toBe("won");
    expect(v.actual).toBe(28);
    expect(legProgressRightLabel(v)).toBe("28 ✓");
    expect(legRowLiveTrackingClass(v)).toBe("leg-row-live-won");
  });

  it("Donovan Mitchell 25+ pts wins; 5+ ast loses at 4", () => {
    const pts = legViewForSnap("3908809-pts-25");
    const ast = legViewForSnap("3908809-ast-5");
    expect(pts.state).toBe("won");
    expect(pts.actual).toBe(30);
    expect(legProgressRightLabel(pts)).toBe("30 ✓");
    expect(ast.state).toBe("lost");
    expect(ast.actual).toBe(4);
    expect(legProgressRightLabel(ast)).toBe("4 ✗");
  });
});